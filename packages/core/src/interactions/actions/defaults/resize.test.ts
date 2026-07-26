import { describe, it, expect, vi } from 'vitest';
import type { Op } from 'core/ops/types';
import { resizeAction } from './resize';
import type { InvocationCtx } from '../invoker';
import type { NodeId } from 'core/scene/types';
import type { ResizeAnchor } from '../../gestures/types';

// Anchor lookup mirroring `buildAffordanceAt`'s convention.
const ANCHOR_FOR_KIND: Record<string, ResizeAnchor> = {
  'handle:top-left':     { x: 'max', y: 'max' },
  'handle:top-right':    { x: 'min', y: 'max' },
  'handle:bottom-left':  { x: 'max', y: 'min' },
  'handle:bottom-right': { x: 'min', y: 'min' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStubScene(initial: Record<string, { pose: unknown }> = {}) {
  const poses = new Map<string, unknown>(
    Object.entries(initial).map(([id, { pose }]) => [id, pose]),
  );
  const batchLog: Array<{ label: string; ops: Array<{ id: string; pose: unknown }> }> = [];
  return {
    poses,
    batchLog,
    get(id: NodeId) {
      if (!poses.has(id)) return undefined;
      return { pose: poses.get(id), kind: 'leaf' as const, layer: 'main', data: {}, parent: null };
    },
    setPose(id: NodeId, pose: unknown) { poses.set(id, pose); },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    batch<T>(_label: string, fn: () => T): T { return fn(); },
    // The commit path now emits transform ops through `commitOps` →
    // `scene.applyBatch` (when no consumer `applyOps`). Mirror the real scene:
    // record one undo entry and apply each op via an adapter that writes the
    // op's target pose to the scene.
    applyBatch(opList: unknown[], label: string) {
      const recorded: Array<{ id: string; pose: unknown }> = [];
      const adapter = {
        setPose(id: string, pose: unknown) {
          recorded.push({ id, pose });
          poses.set(id, pose);
        },
      };
      for (const op of opList as Array<{ apply(a: unknown): void }>) {
        op.apply(adapter);
      }
      batchLog.push({ label, ops: recorded });
    },
  };
}

type RectPose = { x: number; y: number; width: number; height: number };

function makeCtx(
  selectionIds: string[] = ['a'],
  sceneNodes: Record<string, { pose: unknown }> = {},
  affordanceKind?: string,
  fixedPoint?: { x: number; y: number },
): InvocationCtx {
  return {
    world: { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: {
      selection: { get: () => selectionIds as NodeId[] },
      scene: makeStubScene(sceneNodes),
    },
    drag: {
      start: { x: 0, y: 0 },
      current: { x: 20, y: 10 },
      delta: { x: 20, y: 10 },
      ...(affordanceKind !== undefined
        ? {
            affordance: {
              kind: affordanceKind,
              fixedPoint,
              targetIds: selectionIds,
              anchor: ANCHOR_FOR_KIND[affordanceKind],
            },
          }
        : {}),
    },
  };
}

function getOngoingInvoker(action: typeof resizeAction) {
  if (!action.invoker || action.invoker.timing !== 'ongoing') {
    throw new Error('Expected ongoing invoker');
  }
  return action.invoker;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resizeAction descriptor', () => {
  it('declares id, label, drag defaultBinding, and ongoing timing', () => {
    expect(resizeAction.id).toBe('resize');
    expect(resizeAction.label).toBe('Resize');
    expect(resizeAction.defaultBinding).toEqual({ kind: 'drag' });
    expect(resizeAction.invoker?.timing).toBe('ongoing');
  });

  it('requires selection and scene deps', () => {
    expect(resizeAction.requires).toContain('selection');
    expect(resizeAction.requires).toContain('scene');
  });

  it('enabled returns true (invoker self-guards on empty selection)', () => {
    // The dispatcher's specificity-fallthrough loop treats anything `!== true`
    // as "skip this match" — returning a disabled reason here would silently
    // hand the resize binding to lower-specificity ambient bindings (e.g.
    // insertAction's bare drag). See resize.ts `enabled` JSDoc.
    expect(resizeAction.enabled!()).toBe(true);
  });

  // --- Guard behavior ---

  it('start returns empty handle when selection is empty', () => {
    const invoker = getOngoingInvoker(resizeAction);
    const handle = invoker.start(makeCtx([], {}, 'handle:bottom-right'), undefined);
    expect(handle).toEqual({});
  });

  it('start returns empty handle when deps are absent', () => {
    const invoker = getOngoingInvoker(resizeAction);
    const emptyCtx: InvocationCtx = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {},
    };
    const handle = invoker.start(emptyCtx, undefined);
    expect(handle).toEqual({});
  });

  it('start returns empty handle when selection dep is missing', () => {
    const invoker = getOngoingInvoker(resizeAction);
    const ctx: InvocationCtx = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: { scene: makeStubScene({ a: { pose: { x: 0, y: 0, width: 10, height: 10 } } }) },
    };
    const handle = invoker.start(ctx, undefined);
    expect(handle).toEqual({});
  });

  it('start returns empty handle when no affordance in ctx', () => {
    const invoker = getOngoingInvoker(resizeAction);
    // No affordance — cannot determine anchor, so bail.
    const handle = invoker.start(
      makeCtx(['a'], { a: { pose: { x: 0, y: 0, width: 100, height: 100 } } }),
      undefined,
    );
    expect(handle).toEqual({});
  });

  it('start returns empty handle when affordance kind is not handle:*', () => {
    const invoker = getOngoingInvoker(resizeAction);
    // rotate-handle affordance should not trigger resize
    const handle = invoker.start(
      makeCtx(['a'], { a: { pose: { x: 0, y: 0, width: 100, height: 100 } } }, 'rotate-handle'),
      undefined,
    );
    expect(handle).toEqual({});
  });

  // --- Real resize behavior ---

  it('onMove buffers the resized pose in previews (no scene writes)', () => {
    const invoker = getOngoingInvoker(resizeAction);
    const scene = makeStubScene({ a: { pose: { x: 0, y: 0, width: 100, height: 100 } } });
    const ctx: InvocationCtx = {
      world: { x: 100, y: 100 },
      screen: { x: 100, y: 100 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {
        selection: { get: () => ['a' as NodeId] },
        scene,
      },
      drag: {
        start: { x: 100, y: 100 },  // pointer started at bottom-right corner
        current: { x: 100, y: 100 },
        delta: { x: 0, y: 0 },
        affordance: { kind: 'handle:bottom-right', fixedPoint: { x: 0, y: 0 }, targetIds: ['a'], anchor: { x: 'min', y: 'min' } },
      },
    };

    const handle = invoker.start(ctx, undefined);
    expect(handle).not.toEqual({});
    expect(handle.onMove).toBeDefined();

    // Simulate pointer moved to (120, 110) — +20x, +10y
    handle.onMove!({
      ...ctx,
      drag: { start: { x: 100, y: 100 }, current: { x: 120, y: 110 }, delta: { x: 20, y: 10 } },
    });

    // Scene unchanged during drag — preview buffer holds the in-flight pose.
    const pose = scene.poses.get('a') as RectPose;
    expect(pose).toEqual({ x: 0, y: 0, width: 100, height: 100 });

    const preview = handle.previewPose!('a') as RectPose;
    expect(preview.x).toBeCloseTo(0);
    expect(preview.y).toBeCloseTo(0);
    expect(preview.width).toBeCloseTo(120);
    expect(preview.height).toBeCloseTo(110);
    expect(Array.from(handle.previewIds!() ?? [])).toEqual(['a']);
  });

  it('previews resized pose for top-left handle drag', () => {
    const invoker = getOngoingInvoker(resizeAction);
    const scene = makeStubScene({ a: { pose: { x: 0, y: 0, width: 100, height: 100 } } });
    const ctx: InvocationCtx = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {
        selection: { get: () => ['a' as NodeId] },
        scene,
      },
      drag: {
        start: { x: 0, y: 0 },  // pointer started at top-left corner
        current: { x: 0, y: 0 },
        delta: { x: 0, y: 0 },
        affordance: { kind: 'handle:top-left', fixedPoint: { x: 100, y: 100 }, targetIds: ['a'], anchor: { x: 'max', y: 'max' } },
      },
    };

    const handle = invoker.start(ctx, undefined);
    handle.onMove!({
      ...ctx,
      drag: { start: { x: 0, y: 0 }, current: { x: 10, y: 10 }, delta: { x: 10, y: 10 } },
    });

    // Preview pose reflects top-left drag right+down by (10,10).
    const preview = handle.previewPose!('a') as RectPose;
    expect(preview.x).toBeCloseTo(10);
    expect(preview.y).toBeCloseTo(10);
    expect(preview.width).toBeCloseTo(90);
    expect(preview.height).toBeCloseTo(90);

    // Scene unmutated until commit.
    const scenePose = scene.poses.get('a') as RectPose;
    expect(scenePose).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });

  it('onEnd cancel leaves scene unchanged and clears previews', () => {
    const invoker = getOngoingInvoker(resizeAction);
    const scene = makeStubScene({ a: { pose: { x: 0, y: 0, width: 100, height: 100 } } });
    const ctx: InvocationCtx = {
      world: { x: 100, y: 100 },
      screen: { x: 100, y: 100 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {
        selection: { get: () => ['a' as NodeId] },
        scene,
      },
      drag: {
        start: { x: 100, y: 100 },
        current: { x: 100, y: 100 },
        delta: { x: 0, y: 0 },
        affordance: { kind: 'handle:bottom-right', fixedPoint: { x: 0, y: 0 }, targetIds: ['a'], anchor: { x: 'min', y: 'min' } },
      },
    };

    const handle = invoker.start(ctx, undefined);
    handle.onMove!({
      ...ctx,
      drag: { start: { x: 100, y: 100 }, current: { x: 150, y: 150 }, delta: { x: 50, y: 50 } },
    });
    // Scene unchanged during drag.
    expect((scene.poses.get('a') as RectPose).width).toBe(100);

    handle.onEnd!({ ...ctx }, 'cancel');
    const afterCancel = scene.poses.get('a') as RectPose;
    expect(afterCancel.x).toBe(0);
    expect(afterCancel.y).toBe(0);
    expect(afterCancel.width).toBe(100);
    expect(afterCancel.height).toBe(100);
    expect(Array.from(handle.previewIds!() ?? [])).toEqual([]);
  });

  it('onEnd commit writes final preview pose to scene and clears previews', () => {
    const invoker = getOngoingInvoker(resizeAction);
    const scene = makeStubScene({ a: { pose: { x: 0, y: 0, width: 100, height: 100 } } });
    const ctx: InvocationCtx = {
      world: { x: 100, y: 100 },
      screen: { x: 100, y: 100 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {
        selection: { get: () => ['a' as NodeId] },
        scene,
      },
      drag: {
        start: { x: 100, y: 100 },
        current: { x: 100, y: 100 },
        delta: { x: 0, y: 0 },
        affordance: { kind: 'handle:bottom-right', fixedPoint: { x: 0, y: 0 }, targetIds: ['a'], anchor: { x: 'min', y: 'min' } },
      },
    };

    const handle = invoker.start(ctx, undefined);
    handle.onMove!({
      ...ctx,
      drag: { start: { x: 100, y: 100 }, current: { x: 130, y: 120 }, delta: { x: 30, y: 20 } },
    });
    handle.onEnd!({ ...ctx }, 'commit');

    const pose = scene.poses.get('a') as RectPose;
    expect(pose.width).toBeCloseTo(130);
    expect(pose.height).toBeCloseTo(120);
    expect(Array.from(handle.previewIds!() ?? [])).toEqual([]);
  });

  it('onEnd commit with no applyOps routes through scene.applyBatch (one undo entry)', () => {
    const invoker = getOngoingInvoker(resizeAction);
    const scene = makeStubScene({ a: { pose: { x: 0, y: 0, width: 100, height: 100 } } });
    const ctx: InvocationCtx = {
      world: { x: 100, y: 100 },
      screen: { x: 100, y: 100 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {
        selection: { get: () => ['a' as NodeId] },
        scene,
      },
      drag: {
        start: { x: 100, y: 100 },
        current: { x: 100, y: 100 },
        delta: { x: 0, y: 0 },
        affordance: { kind: 'handle:bottom-right', fixedPoint: { x: 0, y: 0 }, targetIds: ['a'], anchor: { x: 'min', y: 'min' } },
      },
    };

    const handle = invoker.start(ctx, undefined);
    handle.onMove!({
      ...ctx,
      drag: { start: { x: 100, y: 100 }, current: { x: 130, y: 120 }, delta: { x: 30, y: 20 } },
    });
    handle.onEnd!({ ...ctx }, 'commit');

    // Exactly one undo entry, labeled 'Resize', applied via applyBatch.
    expect(scene.batchLog).toHaveLength(1);
    expect(scene.batchLog[0].label).toBe('Resize');
    const pose = scene.poses.get('a') as RectPose;
    expect(pose.width).toBeCloseTo(130);
    expect(pose.height).toBeCloseTo(120);
    expect(Array.from(handle.previewIds!() ?? [])).toEqual([]);
  });

  it('onEnd commit routes through consumer applyOps hook when present (once, with Resize label and transform op)', () => {
    const invoker = getOngoingInvoker(resizeAction);
    const scene = makeStubScene({ a: { pose: { x: 0, y: 0, width: 100, height: 100 } } });
    const applyOps = vi.fn<(ops: Op[], label: string) => void>();
    const ctx: InvocationCtx = {
      world: { x: 100, y: 100 },
      screen: { x: 100, y: 100 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {
        selection: { get: () => ['a' as NodeId] },
        scene,
        applyOps,
      },
      drag: {
        start: { x: 100, y: 100 },
        current: { x: 100, y: 100 },
        delta: { x: 0, y: 0 },
        affordance: { kind: 'handle:bottom-right', fixedPoint: { x: 0, y: 0 }, targetIds: ['a'], anchor: { x: 'min', y: 'min' } },
      },
    };

    const handle = invoker.start(ctx, undefined);
    handle.onMove!({
      ...ctx,
      drag: { start: { x: 100, y: 100 }, current: { x: 130, y: 120 }, delta: { x: 30, y: 20 } },
    });
    handle.onEnd!({ ...ctx }, 'commit');

    // Consumer hook owns the commit: called exactly once with the 'Resize'
    // label and one transform op (from = start pose, to = final preview pose).
    expect(applyOps).toHaveBeenCalledTimes(1);
    const [ops, label] = applyOps.mock.calls[0];
    expect(label).toBe('Resize');
    expect(ops).toHaveLength(1);
    expect(ops[0].name).toBe('transform');
    const args = ops[0].args as { id: string; from: RectPose; to: RectPose };
    expect(args.id).toBe('a');
    expect(args.from).toEqual({ x: 0, y: 0, width: 100, height: 100 });
    expect(args.to.width).toBeCloseTo(130);
    expect(args.to.height).toBeCloseTo(120);

    // Consumer owns history → scene's own applyBatch path is NOT used.
    expect(scene.batchLog).toHaveLength(0);
    expect(Array.from(handle.previewIds!() ?? [])).toEqual([]);
  });

  describe('default aspect lock (no resizePolicy dep)', () => {
    const startPose: RectPose = { x: 0, y: 0, width: 100, height: 50 };

    function dragCorner(shift: boolean): RectPose {
      const invoker = getOngoingInvoker(resizeAction);
      const ctx = makeCtx(['a'], { a: { pose: startPose } }, 'handle:bottom-right');
      const handle = invoker.start(ctx, undefined);
      handle.onMove!({
        ...ctx,
        modifiers: { alt: false, ctrl: false, meta: false, shift },
        drag: {
          ...ctx.drag!,
          current: { x: 20, y: 40 },
          delta: { x: 20, y: 40 },
        },
      });
      return handle.previewPose!('a') as RectPose;
    }

    it('shift-drag on a corner keeps the start pose aspect ratio', () => {
      const pose = dragCorner(true);
      // dy (40) dominates: height 50 → 90; width follows the 2:1 ratio.
      expect(pose.height).toBeCloseTo(90);
      expect(pose.width).toBeCloseTo(180);
      expect(pose.width / pose.height).toBeCloseTo(startPose.width / startPose.height);
    });

    it('unmodified drag stays free-form', () => {
      const pose = dragCorner(false);
      expect(pose.width).toBeCloseTo(120);
      expect(pose.height).toBeCloseTo(90);
    });
  });
});
