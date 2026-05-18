import { describe, it, expect } from 'vitest';
import { rotateAction } from './rotate';
import type { InvocationCtx } from '../invoker';
import type { NodeId } from 'core/scene/types';

// ---------------------------------------------------------------------------
// Stub scene (mirrors move.test.ts pattern)
// ---------------------------------------------------------------------------

interface StubScene {
  poses: Map<string, unknown>;
  batchLog: Array<{ label: string; ops: Array<{ id: string; pose: unknown }> }>;
  get(id: NodeId): { pose: unknown; kind: 'leaf'; layer: string; data: unknown; parent: null } | undefined;
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
      return { pose: poses.get(id), kind: 'leaf' as const, layer: 'main', data: {}, parent: null };
    },
    setPose(id: NodeId, pose: unknown) {
      poses.set(id, pose);
    },
    batch<T>(label: string, fn: () => T): T {
      const ops: Array<{ id: string; pose: unknown }> = [];
      const prevSet = this.setPose.bind(this);
      const entry = { label, ops };
      batchLog.push(entry);
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

function makeStubSelection(ids: string[]) {
  return { get: () => ids as NodeId[] };
}

function makeCtx(
  overrides: {
    selectionIds?: string[];
    sceneNodes?: Record<string, { pose: unknown }>;
    world?: { x: number; y: number };
  } = {},
): InvocationCtx & { scene: StubScene } {
  const scene = makeStubScene(overrides.sceneNodes ?? {});
  const selection = makeStubSelection(overrides.selectionIds ?? []);
  return {
    world: overrides.world ?? { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: { selection, scene },
    scene,
  } as InvocationCtx & { scene: StubScene };
}

function getOngoingInvoker(action: typeof rotateAction) {
  if (!action.invoker || action.invoker.timing !== 'ongoing') {
    throw new Error('Expected ongoing invoker');
  }
  return action.invoker;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('rotateAction descriptor', () => {
  it('declares id, label, drag defaultBinding, and ongoing timing', () => {
    expect(rotateAction.id).toBe('rotate');
    expect(rotateAction.label).toBe('Rotate');
    expect(rotateAction.defaultBinding).toEqual({ kind: 'drag' });
    expect(rotateAction.invoker?.timing).toBe('ongoing');
  });

  it('requires selection and scene deps', () => {
    expect(rotateAction.requires).toContain('selection');
    expect(rotateAction.requires).toContain('scene');
  });

  it("enabled returns true (invoker self-guards on empty selection)", () => {
    expect(rotateAction.enabled!()).toBe(true);
  });

  it('start returns empty handle when selection is empty', () => {
    const invoker = getOngoingInvoker(rotateAction);
    const ctx = makeCtx({ selectionIds: [] });
    const handle = invoker.start(ctx, undefined);
    expect(handle).toEqual({});
  });

  it('start returns empty handle when deps are absent', () => {
    const invoker = getOngoingInvoker(rotateAction);
    const emptyCtx: InvocationCtx = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {},
    };
    const handle = invoker.start(emptyCtx, undefined);
    expect(handle).toEqual({});
  });

  it('start returns a handle with onMove and onEnd when selection is non-empty', () => {
    const invoker = getOngoingInvoker(rotateAction);
    const ctx = makeCtx({
      selectionIds: ['a'],
      // Pointer to the right of the center (100+50/2=125 -> at x=125+10 for angle ~0)
      world: { x: 135, y: 75 },
      sceneNodes: { a: { pose: { x: 100, y: 50, width: 50, height: 50, rotation: 0 } } },
    });
    const handle = invoker.start(ctx, undefined);
    expect(typeof handle.onMove).toBe('function');
    expect(typeof handle.onEnd).toBe('function');
  });

  it('onMove tracks angle delta without writing to scene', () => {
    const invoker = getOngoingInvoker(rotateAction);
    // Node centered at (125, 75). Pointer starts directly to the right → angle 0.
    const { scene, ...ctx } = makeCtx({
      selectionIds: ['a'],
      world: { x: 135, y: 75 },
      sceneNodes: { a: { pose: { x: 100, y: 50, width: 50, height: 50, rotation: 0 } } },
    });
    const handle = invoker.start(ctx as InvocationCtx, undefined);

    // Move pointer to directly above center → angle should change.
    handle.onMove!({ ...(ctx as InvocationCtx), world: { x: 125, y: 65 } });

    // Scene must NOT be written during drag.
    expect(scene.poses.get('a')).toEqual({ x: 100, y: 50, width: 50, height: 50, rotation: 0 });
    expect(scene.batchLog).toHaveLength(0);
  });

  it('onEnd("commit") applies rotation via scene.batch and produces one undo entry', () => {
    const invoker = getOngoingInvoker(rotateAction);
    // Node a: center = (125, 75). Pointer starts directly right → angle 0.
    const { scene, ...ctx } = makeCtx({
      selectionIds: ['a'],
      world: { x: 135, y: 75 },
      sceneNodes: { a: { pose: { x: 100, y: 50, width: 50, height: 50, rotation: 0 } } },
    });
    const handle = invoker.start(ctx as InvocationCtx, undefined);

    // Move pointer to directly above center — angle = -π/2.
    handle.onMove!({ ...(ctx as InvocationCtx), world: { x: 125, y: 65 } });
    handle.onEnd!({ ...(ctx as InvocationCtx), world: { x: 125, y: 65 } }, 'commit');

    // Pose should have non-zero rotation after commit.
    const finalPose = scene.poses.get('a') as { rotation: number };
    expect(typeof finalPose.rotation).toBe('number');
    expect(finalPose.rotation).not.toBe(0);

    // Exactly one batch entry named 'Rotate'.
    expect(scene.batchLog).toHaveLength(1);
    expect(scene.batchLog[0].label).toBe('Rotate');
  });

  it('onEnd("commit") is a no-op when delta is zero', () => {
    const invoker = getOngoingInvoker(rotateAction);
    // Pointer starts directly right — no movement.
    const { scene, ...ctx } = makeCtx({
      selectionIds: ['a'],
      world: { x: 135, y: 75 },
      sceneNodes: { a: { pose: { x: 100, y: 50, width: 50, height: 50, rotation: 0 } } },
    });
    const handle = invoker.start(ctx as InvocationCtx, undefined);
    // No onMove call → delta stays 0.
    handle.onEnd!({ ...(ctx as InvocationCtx) }, 'commit');

    // No change, no batch.
    expect(scene.poses.get('a')).toEqual({ x: 100, y: 50, width: 50, height: 50, rotation: 0 });
    expect(scene.batchLog).toHaveLength(0);
  });

  it('onEnd("cancel") does not write to scene', () => {
    const invoker = getOngoingInvoker(rotateAction);
    const { scene, ...ctx } = makeCtx({
      selectionIds: ['a'],
      world: { x: 135, y: 75 },
      sceneNodes: { a: { pose: { x: 100, y: 50, width: 50, height: 50, rotation: 0 } } },
    });
    const handle = invoker.start(ctx as InvocationCtx, undefined);
    handle.onMove!({ ...(ctx as InvocationCtx), world: { x: 125, y: 65 } });
    handle.onEnd!({ ...(ctx as InvocationCtx) }, 'cancel');

    // Cancel: no writes.
    expect(scene.poses.get('a')).toEqual({ x: 100, y: 50, width: 50, height: 50, rotation: 0 });
    expect(scene.batchLog).toHaveLength(0);
  });

  it('previewIds/previewPose expose in-flight rotated poses; cleared on commit', () => {
    const invoker = getOngoingInvoker(rotateAction);
    const { scene, ...ctx } = makeCtx({
      selectionIds: ['a'],
      world: { x: 135, y: 75 },
      sceneNodes: { a: { pose: { x: 100, y: 50, width: 50, height: 50, rotation: 0 } } },
    });
    const handle = invoker.start(ctx as InvocationCtx, undefined);
    expect(Array.from(handle.previewIds!() ?? [])).toEqual([]);
    handle.onMove!({ ...(ctx as InvocationCtx), world: { x: 125, y: 65 } });
    const preview = handle.previewPose!('a') as { rotation: number };
    expect(typeof preview.rotation).toBe('number');
    expect(preview.rotation).not.toBe(0);
    expect(Array.from(handle.previewIds!() ?? [])).toEqual(['a']);
    expect(scene.poses.get('a')).toEqual({ x: 100, y: 50, width: 50, height: 50, rotation: 0 });

    handle.onEnd!({ ...(ctx as InvocationCtx), world: { x: 125, y: 65 } }, 'commit');
    expect(Array.from(handle.previewIds!() ?? [])).toEqual([]);
    const final = scene.poses.get('a') as { rotation: number };
    expect(final.rotation).toBeCloseTo(preview.rotation);
  });

  it('cancel discards previews; scene unchanged', () => {
    const invoker = getOngoingInvoker(rotateAction);
    const { scene, ...ctx } = makeCtx({
      selectionIds: ['a'],
      world: { x: 135, y: 75 },
      sceneNodes: { a: { pose: { x: 100, y: 50, width: 50, height: 50, rotation: 0 } } },
    });
    const handle = invoker.start(ctx as InvocationCtx, undefined);
    handle.onMove!({ ...(ctx as InvocationCtx), world: { x: 125, y: 65 } });
    expect(Array.from(handle.previewIds!() ?? []).length).toBe(1);
    handle.onEnd!({ ...(ctx as InvocationCtx) }, 'cancel');
    expect(Array.from(handle.previewIds!() ?? [])).toEqual([]);
    expect(scene.poses.get('a')).toEqual({ x: 100, y: 50, width: 50, height: 50, rotation: 0 });
  });

  it('multi-selection: commits rotation for all selected nodes (union-pivot mode)', () => {
    const invoker = getOngoingInvoker(rotateAction);
    // Two nodes: a at (0,0,10,10) center=(5,5), b at (20,0,10,10) center=(25,5).
    // Union center = (15, 5). Pointer starts at (25, 5) → angle 0.
    const { scene, ...ctx } = makeCtx({
      selectionIds: ['a', 'b'],
      world: { x: 25, y: 5 },
      sceneNodes: {
        a: { pose: { x: 0, y: 0, width: 10, height: 10, rotation: 0 } },
        b: { pose: { x: 20, y: 0, width: 10, height: 10, rotation: 0 } },
      },
    });
    const handle = invoker.start(ctx as InvocationCtx, undefined);
    // Move pointer to directly above union center → angle changes by ~π/2.
    handle.onMove!({ ...(ctx as InvocationCtx), world: { x: 15, y: -5 } });
    handle.onEnd!({ ...(ctx as InvocationCtx), world: { x: 15, y: -5 } }, 'commit');

    // Both nodes should be rotated.
    const poseA = scene.poses.get('a') as { rotation: number };
    const poseB = scene.poses.get('b') as { rotation: number };
    expect(poseA.rotation).not.toBe(0);
    expect(poseB.rotation).not.toBe(0);
    expect(scene.batchLog).toHaveLength(1);
    expect(scene.batchLog[0].label).toBe('Rotate');
    // Both nodes should be in the same batch.
    expect(scene.batchLog[0].ops).toHaveLength(2);
  });
});
