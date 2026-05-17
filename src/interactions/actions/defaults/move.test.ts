import { describe, it, expect } from 'vitest';
import { moveAction } from './move';
import { ActionDisabledReason } from '../registry';
import type { InvocationCtx } from '../invoker';
import type { NodeId } from 'core/scene/types';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Minimal InvocationCtx with optional drag delta override. */
function makeCtx(
  overrides: {
    selectionIds?: string[];
    sceneNodes?: Record<string, { pose: unknown }>;
    drag?: { start: { x: number; y: number }; current: { x: number; y: number }; delta: { x: number; y: number } };
  } = {},
): InvocationCtx & { scene: StubScene } {
  const scene = makeStubScene(overrides.sceneNodes ?? {});
  const selection = makeStubSelection(overrides.selectionIds ?? []);
  return {
    world: { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: { selection, scene },
    drag: overrides.drag,
    scene,
  } as InvocationCtx & { scene: StubScene };
}

// ---------------------------------------------------------------------------
// Stub scene
// ---------------------------------------------------------------------------

interface StubScene {
  poses: Map<string, unknown>;
  batchLog: Array<{ label: string; ops: Array<{ id: string; pose: unknown }> }>;
  get(id: NodeId): { pose: unknown } | undefined;
  setPose(id: NodeId, pose: unknown): void;
  batch<T>(label: string, fn: () => T): T;
}

function makeStubScene(initial: Record<string, { pose: unknown }>): StubScene {
  const poses = new Map<string, unknown>(
    Object.entries(initial).map(([id, { pose }]) => [id, pose]),
  );
  const batchLog: Array<{ label: string; ops: Array<{ id: string; pose: unknown }> }> = [];

  return {
    poses,
    batchLog,
    get(id: NodeId) {
      if (!poses.has(id)) return undefined;
      return { pose: poses.get(id) };
    },
    setPose(id: NodeId, pose: unknown) {
      poses.set(id, pose);
    },
    batch<T>(label: string, fn: () => T): T {
      const ops: Array<{ id: string; pose: unknown }> = [];
      const prevSet = this.setPose.bind(this);
      const entry = { label, ops };
      batchLog.push(entry);
      // Intercept setPose calls inside the batch to record them.
      this.setPose = (id: NodeId, pose: unknown) => {
        ops.push({ id, pose });
        poses.set(id, pose);
      };
      const result = fn();
      this.setPose = prevSet;
      return result;
    },
  };
}

// ---------------------------------------------------------------------------
// Stub selection
// ---------------------------------------------------------------------------

function makeStubSelection(ids: string[]) {
  return { get: () => ids as NodeId[] };
}

// ---------------------------------------------------------------------------
// Utility: unwrap invoker safely
// ---------------------------------------------------------------------------

function getOngoingInvoker(action: typeof moveAction) {
  if (!action.invoker || action.invoker.timing !== 'ongoing') {
    throw new Error('Expected ongoing invoker');
  }
  return action.invoker;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('moveAction descriptor', () => {
  it('declares ongoing timing, drag gestureBinding, id and label', () => {
    expect(moveAction.id).toBe('move');
    expect(moveAction.label).toBe('Move');
    expect(moveAction.invoker?.timing).toBe('ongoing');
    expect(moveAction.gestureBinding).toEqual({ kind: 'drag' });
  });

  it('start returns empty handle when selection is empty', () => {
    const invoker = getOngoingInvoker(moveAction);
    const ctx = makeCtx({ selectionIds: [] });
    const handle = invoker.start(ctx, undefined);
    expect(handle).toEqual({});
  });

  it('start returns empty handle when selection dep is missing', () => {
    const invoker = getOngoingInvoker(moveAction);
    const ctx: InvocationCtx = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {},
    };
    const handle = invoker.start(ctx, undefined);
    expect(handle).toEqual({});
  });

  it('start returns a handle with onMove and onEnd when selection is non-empty', () => {
    const invoker = getOngoingInvoker(moveAction);
    const ctx = makeCtx({
      selectionIds: ['a'],
      sceneNodes: { a: { pose: { x: 10, y: 20, width: 50, height: 50 } } },
    });
    const handle = invoker.start(ctx, undefined);
    expect(typeof handle.onMove).toBe('function');
    expect(typeof handle.onEnd).toBe('function');
  });

  it('onMove tracks delta without writing to scene', () => {
    const invoker = getOngoingInvoker(moveAction);
    const { scene, ...ctx } = makeCtx({
      selectionIds: ['a'],
      sceneNodes: { a: { pose: { x: 10, y: 20, width: 50, height: 50 } } },
    });

    const handle = invoker.start(ctx as InvocationCtx, undefined);

    // Pose should not change after onMove — scene writes happen only at commit.
    const moveCtx: InvocationCtx = {
      ...ctx,
      drag: {
        start: { x: 0, y: 0 },
        current: { x: 30, y: 40 },
        delta: { x: 30, y: 40 },
      },
    };
    handle.onMove!(moveCtx);

    // Scene unchanged during drag.
    expect(scene.poses.get('a')).toEqual({ x: 10, y: 20, width: 50, height: 50 });
    expect(scene.batchLog).toHaveLength(0);
  });

  it('onEnd("commit") applies final delta via scene.batch and produces one undo entry', () => {
    const invoker = getOngoingInvoker(moveAction);
    const { scene, ...ctx } = makeCtx({
      selectionIds: ['a', 'b'],
      sceneNodes: {
        a: { pose: { x: 0, y: 0, width: 10, height: 10 } },
        b: { pose: { x: 100, y: 100, width: 20, height: 20 } },
      },
    });

    const handle = invoker.start(ctx as InvocationCtx, undefined);

    const moveCtx: InvocationCtx = {
      ...ctx,
      drag: {
        start: { x: 0, y: 0 },
        current: { x: 5, y: 7 },
        delta: { x: 5, y: 7 },
      },
    };
    handle.onMove!(moveCtx);
    handle.onEnd!(moveCtx, 'commit');

    // Both nodes should be translated.
    expect(scene.poses.get('a')).toEqual({ x: 5, y: 7, width: 10, height: 10 });
    expect(scene.poses.get('b')).toEqual({ x: 105, y: 107, width: 20, height: 20 });

    // Exactly one batch entry named 'Move'.
    expect(scene.batchLog).toHaveLength(1);
    expect(scene.batchLog[0].label).toBe('Move');
  });

  it('onEnd("commit") is a no-op when delta is zero (sub-threshold)', () => {
    const invoker = getOngoingInvoker(moveAction);
    const { scene, ...ctx } = makeCtx({
      selectionIds: ['a'],
      sceneNodes: { a: { pose: { x: 10, y: 10, width: 10, height: 10 } } },
    });

    const handle = invoker.start(ctx as InvocationCtx, undefined);
    // No onMove call → delta stays {0, 0}.
    const endCtx: InvocationCtx = {
      ...ctx,
      drag: { start: { x: 0, y: 0 }, current: { x: 0, y: 0 }, delta: { x: 0, y: 0 } },
    };
    handle.onEnd!(endCtx, 'commit');

    // No scene writes, no batch.
    expect(scene.poses.get('a')).toEqual({ x: 10, y: 10, width: 10, height: 10 });
    expect(scene.batchLog).toHaveLength(0);
  });

  it('onEnd("cancel") does not write to scene', () => {
    const invoker = getOngoingInvoker(moveAction);
    const { scene, ...ctx } = makeCtx({
      selectionIds: ['a'],
      sceneNodes: { a: { pose: { x: 10, y: 20, width: 50, height: 50 } } },
    });

    const handle = invoker.start(ctx as InvocationCtx, undefined);

    const moveCtx: InvocationCtx = {
      ...ctx,
      drag: {
        start: { x: 0, y: 0 },
        current: { x: 99, y: 99 },
        delta: { x: 99, y: 99 },
      },
    };
    handle.onMove!(moveCtx);
    handle.onEnd!(moveCtx, 'cancel');

    // Scene unchanged — cancel is a no-op (scene was never mutated during drag).
    expect(scene.poses.get('a')).toEqual({ x: 10, y: 20, width: 50, height: 50 });
    expect(scene.batchLog).toHaveLength(0);
  });

  it('enabled returns SelectionRequired', () => {
    expect(moveAction.enabled!()).toBe(ActionDisabledReason.SelectionRequired);
  });

  it('commit applies latest delta (multiple onMove calls, last one wins)', () => {
    const invoker = getOngoingInvoker(moveAction);
    const { scene, ...ctx } = makeCtx({
      selectionIds: ['a'],
      sceneNodes: { a: { pose: { x: 0, y: 0, width: 10, height: 10 } } },
    });

    const handle = invoker.start(ctx as InvocationCtx, undefined);

    // Simulate pointer moving across multiple frames.
    for (const delta of [{ x: 1, y: 1 }, { x: 5, y: 3 }, { x: 12, y: 8 }]) {
      handle.onMove!({
        ...ctx,
        drag: { start: { x: 0, y: 0 }, current: { x: delta.x, y: delta.y }, delta },
      } as InvocationCtx);
    }
    handle.onEnd!(
      { ...ctx, drag: { start: { x: 0, y: 0 }, current: { x: 12, y: 8 }, delta: { x: 12, y: 8 } } } as InvocationCtx,
      'commit',
    );

    // Final delta {12, 8} applied from origin {0,0}.
    expect(scene.poses.get('a')).toEqual({ x: 12, y: 8, width: 10, height: 10 });
    expect(scene.batchLog).toHaveLength(1);
    expect(scene.batchLog[0].label).toBe('Move');
  });
});
