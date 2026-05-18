import { describe, it, expect } from 'vitest';
import { resizeAction } from './resize';
import { ActionDisabledReason } from '../registry';
import type { InvocationCtx } from '../invoker';
import type { NodeId } from 'core/scene/types';
import type { ResizeAnchor } from '../../gestures/types';

// Phase 12: anchor lookup mirroring `buildAffordanceAt`'s convention.
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
  return {
    poses,
    get(id: NodeId) {
      if (!poses.has(id)) return undefined;
      return { pose: poses.get(id), kind: 'leaf' as const, layer: 'main', data: {}, parent: null };
    },
    setPose(id: NodeId, pose: unknown) { poses.set(id, pose); },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    batch<T>(_label: string, fn: () => T): T { return fn(); },
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

  it('enabled returns SelectionRequired', () => {
    expect(resizeAction.enabled!()).toBe(ActionDisabledReason.SelectionRequired);
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
});
