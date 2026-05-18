import { describe, it, expect } from 'vitest';
import { cloneAction } from './clone';
import type { InvocationCtx } from '../invoker';
import type { NodeId, AddNodeSpec } from 'core/scene/types';

// ---------------------------------------------------------------------------
// Stub scene
// ---------------------------------------------------------------------------

interface StubScene {
  poses: Map<string, unknown>;
  nodes: Map<string, { pose: unknown; kind: 'leaf' | 'container'; layer: string; data: unknown; parent: NodeId | null }>;
  addLog: AddNodeSpec<unknown, string, unknown>[];
  batchLog: Array<{ label: string }>;
  get(id: NodeId): { pose: unknown; kind: 'leaf'; layer: string; data: unknown; parent: NodeId | null } | undefined;
  setPose(id: NodeId, pose: unknown): void;
  add(spec: AddNodeSpec<unknown, string, unknown>): NodeId;
  batch<T>(label: string, fn: () => T): T;
}

function makeStubScene(
  initial: Record<string, { pose: unknown; data?: unknown; layer?: string; kind?: 'leaf' | 'container' }> = {},
): StubScene {
  const poses = new Map<string, unknown>();
  const nodes = new Map<string, { pose: unknown; kind: 'leaf' | 'container'; layer: string; data: unknown; parent: NodeId | null }>();
  for (const [id, v] of Object.entries(initial)) {
    poses.set(id, v.pose);
    nodes.set(id, { pose: v.pose, kind: v.kind ?? 'leaf', layer: v.layer ?? 'main', data: v.data ?? {}, parent: null });
  }
  const addLog: AddNodeSpec<unknown, string, unknown>[] = [];
  const batchLog: Array<{ label: string }> = [];
  let nextId = 1;

  return {
    poses,
    nodes,
    addLog,
    batchLog,
    get(id: NodeId) {
      const n = nodes.get(id);
      if (!n) return undefined;
      return n as { pose: unknown; kind: 'leaf'; layer: string; data: unknown; parent: NodeId | null };
    },
    setPose(id: NodeId, pose: unknown) { poses.set(id, pose); },
    add(spec) {
      addLog.push(spec);
      const id = `clone-${nextId++}` as NodeId;
      return id;
    },
    batch<T>(label: string, fn: () => T): T {
      batchLog.push({ label });
      return fn();
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
    drag?: { start: { x: number; y: number }; current: { x: number; y: number }; delta: { x: number; y: number } };
  } = {},
): InvocationCtx & { scene: StubScene } {
  const scene = makeStubScene(overrides.sceneNodes ?? {});
  const selection = makeStubSelection(overrides.selectionIds ?? []);
  return {
    world: overrides.world ?? { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: true, ctrl: false, meta: false, shift: false },
    deps: { selection, scene },
    drag: overrides.drag,
    scene,
  } as InvocationCtx & { scene: StubScene };
}

function getOngoingInvoker(action: typeof cloneAction) {
  if (!action.invoker || action.invoker.timing !== 'ongoing') {
    throw new Error('Expected ongoing invoker');
  }
  return action.invoker;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('cloneAction descriptor', () => {
  it('declares id, label, drag defaultBinding, and ongoing timing', () => {
    expect(cloneAction.id).toBe('clone');
    expect(cloneAction.label).toBe('Clone');
    expect(cloneAction.defaultBinding).toEqual({ kind: 'drag' });
    expect(cloneAction.invoker?.timing).toBe('ongoing');
  });

  it('requires selection and scene deps', () => {
    expect(cloneAction.requires).toContain('selection');
    expect(cloneAction.requires).toContain('scene');
  });

  it("enabled returns true (invoker self-guards on empty selection)", () => {
    expect(cloneAction.enabled!()).toBe(true);
  });

  it('start returns empty handle when selection is empty', () => {
    const invoker = getOngoingInvoker(cloneAction);
    const handle = invoker.start(makeCtx({ selectionIds: [] }), undefined);
    expect(handle).toEqual({});
  });

  it('start returns empty handle when deps are absent', () => {
    const invoker = getOngoingInvoker(cloneAction);
    const emptyCtx: InvocationCtx = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: true, ctrl: false, meta: false, shift: false },
      deps: {},
    };
    const handle = invoker.start(emptyCtx, undefined);
    expect(handle).toEqual({});
  });

  it('start returns a handle with onMove and onEnd when selection+scene present', () => {
    const invoker = getOngoingInvoker(cloneAction);
    const ctx = makeCtx({
      selectionIds: ['a'],
      sceneNodes: { a: { pose: { x: 10, y: 20, width: 50, height: 50 } } },
    });
    const handle = invoker.start(ctx, undefined);
    expect(typeof handle.onMove).toBe('function');
    expect(typeof handle.onEnd).toBe('function');
  });

  it('onMove does not write to scene', () => {
    const invoker = getOngoingInvoker(cloneAction);
    const { scene, ...ctx } = makeCtx({
      selectionIds: ['a'],
      sceneNodes: { a: { pose: { x: 10, y: 20, width: 50, height: 50 } } },
    });
    const handle = invoker.start(ctx as InvocationCtx, undefined);
    handle.onMove!({
      ...(ctx as InvocationCtx),
      drag: { start: { x: 0, y: 0 }, current: { x: 30, y: 40 }, delta: { x: 30, y: 40 } },
    });
    expect(scene.addLog).toHaveLength(0);
    expect(scene.batchLog).toHaveLength(0);
  });

  it('onEnd("commit") adds a clone of each selected node with translated pose', () => {
    const invoker = getOngoingInvoker(cloneAction);
    const { scene, ...ctx } = makeCtx({
      selectionIds: ['a'],
      sceneNodes: { a: { pose: { x: 10, y: 20, width: 50, height: 50 } } },
    });
    const handle = invoker.start(ctx as InvocationCtx, undefined);
    handle.onMove!({
      ...(ctx as InvocationCtx),
      drag: { start: { x: 0, y: 0 }, current: { x: 15, y: 25 }, delta: { x: 15, y: 25 } },
    });
    handle.onEnd!(
      { ...(ctx as InvocationCtx), drag: { start: { x: 0, y: 0 }, current: { x: 15, y: 25 }, delta: { x: 15, y: 25 } } },
      'commit',
    );

    // One clone added.
    expect(scene.addLog).toHaveLength(1);
    const added = scene.addLog[0];
    // Pose should be translated by (15, 25) from origin (10, 20).
    expect(added.pose).toEqual(expect.objectContaining({ x: 25, y: 45 }));
    // Kind and layer preserved.
    expect(added.kind).toBe('leaf');
    expect(added.layer).toBe('main');
  });

  it('onEnd("commit") produces exactly one batch entry named "Clone"', () => {
    const invoker = getOngoingInvoker(cloneAction);
    const { scene, ...ctx } = makeCtx({
      selectionIds: ['a', 'b'],
      sceneNodes: {
        a: { pose: { x: 0, y: 0, width: 10, height: 10 } },
        b: { pose: { x: 20, y: 20, width: 10, height: 10 } },
      },
    });
    const handle = invoker.start(ctx as InvocationCtx, undefined);
    handle.onMove!({
      ...(ctx as InvocationCtx),
      drag: { start: { x: 0, y: 0 }, current: { x: 5, y: 5 }, delta: { x: 5, y: 5 } },
    });
    handle.onEnd!(
      { ...(ctx as InvocationCtx), drag: { start: { x: 0, y: 0 }, current: { x: 5, y: 5 }, delta: { x: 5, y: 5 } } },
      'commit',
    );

    // Two clones (one per selection), one batch.
    expect(scene.addLog).toHaveLength(2);
    expect(scene.batchLog).toHaveLength(1);
    expect(scene.batchLog[0].label).toBe('Clone');
  });

  it('onEnd("commit") is a no-op when delta is zero', () => {
    const invoker = getOngoingInvoker(cloneAction);
    const { scene, ...ctx } = makeCtx({
      selectionIds: ['a'],
      sceneNodes: { a: { pose: { x: 10, y: 10, width: 10, height: 10 } } },
    });
    const handle = invoker.start(ctx as InvocationCtx, undefined);
    // No onMove → delta stays zero.
    handle.onEnd!({ ...(ctx as InvocationCtx) }, 'commit');
    expect(scene.addLog).toHaveLength(0);
    expect(scene.batchLog).toHaveLength(0);
  });

  it('previewIds/previewPose expose translated originals during drag; cleared on commit', () => {
    const invoker = getOngoingInvoker(cloneAction);
    const { ...ctx } = makeCtx({
      selectionIds: ['a'],
      sceneNodes: { a: { pose: { x: 10, y: 20, width: 50, height: 50 } } },
    });
    const handle = invoker.start(ctx as InvocationCtx, undefined);
    expect(Array.from(handle.previewIds!() ?? [])).toEqual([]);

    handle.onMove!({
      ...(ctx as InvocationCtx),
      drag: { start: { x: 0, y: 0 }, current: { x: 5, y: 6 }, delta: { x: 5, y: 6 } },
    });
    expect(Array.from(handle.previewIds!() ?? [])).toEqual(['a']);
    expect(handle.previewPose!('a')).toEqual({ x: 15, y: 26, width: 50, height: 50 });

    handle.onEnd!(
      { ...(ctx as InvocationCtx), drag: { start: { x: 0, y: 0 }, current: { x: 5, y: 6 }, delta: { x: 5, y: 6 } } },
      'commit',
    );
    expect(Array.from(handle.previewIds!() ?? [])).toEqual([]);
  });

  it('previewPose returns a translated pose shape consumable by drawOne (canvas preview path)', () => {
    // Phase 14e.2.5 sub-deliverable 3 — verifies the dispatcher preview
    // shape is rect-pose-like ({x, y, width, height, ...}), matching what
    // `usePreviewGhostLayer`'s `drawOne` consumes. This is the equivalent
    // of the legacy `useClone`/`defaultDrawGhost` `{id, x, y}` overlay
    // shape, but driven entirely through the dispatcher.
    const invoker = getOngoingInvoker(cloneAction);
    const { ...ctx } = makeCtx({
      selectionIds: ['a', 'b'],
      sceneNodes: {
        a: { pose: { x: 10, y: 20, width: 40, height: 30 } },
        b: { pose: { x: 100, y: 200, width: 5, height: 5 } },
      },
    });
    const handle = invoker.start(ctx as InvocationCtx, undefined);
    handle.onMove!({
      ...(ctx as InvocationCtx),
      drag: { start: { x: 0, y: 0 }, current: { x: 7, y: 11 }, delta: { x: 7, y: 11 } },
    });

    // Two ids previewed at the translated positions; original pose fields
    // (width/height) preserved so the preview ghost has full geometry.
    const ids = Array.from(handle.previewIds!() ?? []);
    expect(ids.sort()).toEqual(['a', 'b']);
    expect(handle.previewPose!('a')).toEqual({ x: 17, y: 31, width: 40, height: 30 });
    expect(handle.previewPose!('b')).toEqual({ x: 107, y: 211, width: 5, height: 5 });
  });

  it('cancel discards preview state; no nodes added', () => {
    const invoker = getOngoingInvoker(cloneAction);
    const { scene, ...ctx } = makeCtx({
      selectionIds: ['a'],
      sceneNodes: { a: { pose: { x: 0, y: 0, width: 10, height: 10 } } },
    });
    const handle = invoker.start(ctx as InvocationCtx, undefined);
    handle.onMove!({
      ...(ctx as InvocationCtx),
      drag: { start: { x: 0, y: 0 }, current: { x: 5, y: 5 }, delta: { x: 5, y: 5 } },
    });
    expect(Array.from(handle.previewIds!() ?? []).length).toBe(1);
    handle.onEnd!(
      { ...(ctx as InvocationCtx), drag: { start: { x: 0, y: 0 }, current: { x: 5, y: 5 }, delta: { x: 5, y: 5 } } },
      'cancel',
    );
    expect(Array.from(handle.previewIds!() ?? [])).toEqual([]);
    expect(scene.addLog).toHaveLength(0);
  });

  it('onEnd("cancel") does not add any nodes', () => {
    const invoker = getOngoingInvoker(cloneAction);
    const { scene, ...ctx } = makeCtx({
      selectionIds: ['a'],
      sceneNodes: { a: { pose: { x: 10, y: 20, width: 50, height: 50 } } },
    });
    const handle = invoker.start(ctx as InvocationCtx, undefined);
    handle.onMove!({
      ...(ctx as InvocationCtx),
      drag: { start: { x: 0, y: 0 }, current: { x: 99, y: 99 }, delta: { x: 99, y: 99 } },
    });
    handle.onEnd!(
      { ...(ctx as InvocationCtx), drag: { start: { x: 0, y: 0 }, current: { x: 99, y: 99 }, delta: { x: 99, y: 99 } } },
      'cancel',
    );
    expect(scene.addLog).toHaveLength(0);
  });
});
