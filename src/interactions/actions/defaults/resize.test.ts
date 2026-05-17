import { describe, it, expect } from 'vitest';
import { resizeAction } from './resize';
import { ActionDisabledReason } from '../registry';
import type { InvocationCtx } from '../invoker';
import type { NodeId } from 'core/scene/types';

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
        ? { affordance: { kind: affordanceKind, fixedPoint, targetIds: selectionIds } }
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
  it('declares id, label, drag gestureBinding, and ongoing timing', () => {
    expect(resizeAction.id).toBe('resize');
    expect(resizeAction.label).toBe('Resize');
    expect(resizeAction.gestureBinding).toEqual({ kind: 'drag' });
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

  it('onMove resizes the node by dragging bottom-right handle', () => {
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
        affordance: { kind: 'handle:bottom-right', fixedPoint: { x: 0, y: 0 }, targetIds: ['a'] },
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

    const pose = scene.poses.get('a') as RectPose;
    expect(pose.x).toBeCloseTo(0);
    expect(pose.y).toBeCloseTo(0);
    expect(pose.width).toBeCloseTo(120);
    expect(pose.height).toBeCloseTo(110);
  });

  it('onMove resizes the node by dragging top-left handle', () => {
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
        affordance: { kind: 'handle:top-left', fixedPoint: { x: 100, y: 100 }, targetIds: ['a'] },
      },
    };

    const handle = invoker.start(ctx, undefined);
    handle.onMove!({
      ...ctx,
      drag: { start: { x: 0, y: 0 }, current: { x: 10, y: 10 }, delta: { x: 10, y: 10 } },
    });

    const pose = scene.poses.get('a') as RectPose;
    // top-left dragged right+down by (10,10): x shifts +10, width shrinks by 10
    expect(pose.x).toBeCloseTo(10);
    expect(pose.y).toBeCloseTo(10);
    expect(pose.width).toBeCloseTo(90);
    expect(pose.height).toBeCloseTo(90);
  });

  it('onEnd cancel restores original pose', () => {
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
        affordance: { kind: 'handle:bottom-right', fixedPoint: { x: 0, y: 0 }, targetIds: ['a'] },
      },
    };

    const handle = invoker.start(ctx, undefined);
    // Move — mutates scene.
    handle.onMove!({
      ...ctx,
      drag: { start: { x: 100, y: 100 }, current: { x: 150, y: 150 }, delta: { x: 50, y: 50 } },
    });
    const afterMove = scene.poses.get('a') as RectPose;
    expect(afterMove.width).toBe(150);

    // Cancel — restores original pose exactly.
    handle.onEnd!({ ...ctx }, 'cancel');
    const afterCancel = scene.poses.get('a') as RectPose;
    expect(afterCancel.x).toBe(0);
    expect(afterCancel.y).toBe(0);
    expect(afterCancel.width).toBe(100);  // restored from startPoses (exact copy)
    expect(afterCancel.height).toBe(100);
  });

  it('onEnd commit leaves final pose in place', () => {
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
        affordance: { kind: 'handle:bottom-right', fixedPoint: { x: 0, y: 0 }, targetIds: ['a'] },
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
  });
});
