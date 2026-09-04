import { describe, it, expect, vi } from 'vitest';
import { cloneAction } from './clone';
import type { InvocationCtx } from '../invoker';
import type { NodeId, AddNodeSpec } from 'core/scene/types';
import type { Op } from 'core/ops/types';

// ---------------------------------------------------------------------------
// Stub scene
// ---------------------------------------------------------------------------

interface StubScene {
  poses: Map<string, unknown>;
  nodes: Map<string, { pose: unknown; kind: 'leaf' | 'container'; layer: string; data: unknown; parent: NodeId | null }>;
  addLog: AddNodeSpec<unknown, string, unknown>[];
  applyBatchLog: Array<{ ops: Op[]; label: string }>;
  get(id: NodeId): { pose: unknown; kind: 'leaf'; layer: string; data: unknown; parent: NodeId | null } | undefined;
  setPose(id: NodeId, pose: unknown): void;
  add(spec: AddNodeSpec<unknown, string, unknown>): NodeId;
  remove(id: NodeId): void;
  move(id: NodeId, parent: NodeId | null, index?: number): void;
  update(id: NodeId, patch: { data: unknown }): void;
  setLayer(id: NodeId, layer: string): void;
  reorder(id: NodeId, index: number): void;
  renderOrder(): Iterable<NodeId>;
  get roots(): readonly NodeId[];
  childrenOf(id: NodeId): readonly NodeId[];
  applyBatch(ops: Op[], label: string, adapter: unknown): void;
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
  const applyBatchLog: Array<{ ops: Op[]; label: string }> = [];
  let nextId = 1;

  const scene: StubScene = {
    poses,
    nodes,
    addLog,
    applyBatchLog,
    get(id: NodeId) {
      const n = nodes.get(id);
      if (!n) return undefined;
      return n as { pose: unknown; kind: 'leaf'; layer: string; data: unknown; parent: NodeId | null };
    },
    setPose(id: NodeId, pose: unknown) { poses.set(id, pose); },
    add(spec) {
      addLog.push(spec);
      const id = (spec.id ?? `clone-${nextId++}`) as NodeId;
      nodes.set(id as string, {
        pose: spec.pose,
        kind: spec.kind,
        layer: spec.layer,
        data: spec.data,
        parent: (spec.parent ?? null) as NodeId | null,
      });
      return id;
    },
    remove() { /* unused */ },
    move() { /* unused */ },
    update() { /* unused */ },
    setLayer() { /* unused */ },
    reorder() { /* unused */ },
    renderOrder() { return nodes.keys() as unknown as Iterable<NodeId>; },
    get roots() {
      return [...nodes.keys()].filter((id) => nodes.get(id)!.parent == null).map((id) => id as NodeId);
    },
    childrenOf(id: NodeId) {
      return [...nodes.entries()].filter(([, n]) => n.parent === id).map(([cid]) => cid as NodeId);
    },
    applyBatch(ops: Op[], label: string, adapter: unknown) {
      applyBatchLog.push({ ops, label });
      for (const op of ops) op.apply(adapter);
    },
  };
  return scene;
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
    applyOps?: (ops: Op[], label: string) => void;
  } = {},
): InvocationCtx & { scene: StubScene } {
  const scene = makeStubScene(overrides.sceneNodes ?? {});
  const selection = makeStubSelection(overrides.selectionIds ?? []);
  const deps: Record<string, unknown> = { selection, scene };
  if (overrides.applyOps) deps.applyOps = overrides.applyOps;
  return {
    world: overrides.world ?? { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: true, ctrl: false, meta: false, shift: false },
    deps,
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
    expect(scene.applyBatchLog).toHaveLength(0);
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

    // One clone added (via the applyBatch fallback's adapter.insertNode).
    expect(scene.addLog).toHaveLength(1);
    const added = scene.addLog[0];
    // Pose should be translated by (15, 25) from origin (10, 20).
    expect(added.pose).toEqual(expect.objectContaining({ x: 25, y: 45 }));
    // Kind and layer preserved.
    expect(added.kind).toBe('leaf');
    expect(added.layer).toBe('main');
  });

  it('onEnd("commit") produces exactly one applyBatch entry named "Clone"', () => {
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
    expect(scene.applyBatchLog).toHaveLength(1);
    expect(scene.applyBatchLog[0].label).toBe('Clone');
  });

  it('routes commit through the consumer applyOps hook once with insert ops + "Clone" label', () => {
    const invoker = getOngoingInvoker(cloneAction);
    const applyOps = vi.fn<(ops: Op[], label: string) => void>();
    const { scene, ...ctx } = makeCtx({
      selectionIds: ['a', 'b'],
      sceneNodes: {
        a: { pose: { x: 10, y: 20, width: 50, height: 50 } },
        b: { pose: { x: 0, y: 0, width: 5, height: 5 } },
      },
      applyOps,
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

    // applyOps owns the commit — exactly one call with insert ops + label.
    expect(applyOps).toHaveBeenCalledOnce();
    const [ops, label] = applyOps.mock.calls[0];
    expect(label).toBe('Clone');
    expect(ops).toHaveLength(2);
    for (const op of ops) expect(op.name).toBe('insert');

    // Each insert op carries a full node: fresh id, preserved kind/layer/data/
    // parent, and pose translated by the drag delta.
    const n0 = (ops[0].args as { node: { id: string; kind: string; layer: string; pose: unknown; parent: NodeId | null } }).node;
    expect(n0.id).toBeTruthy();
    expect(n0.kind).toBe('leaf');
    expect(n0.layer).toBe('main');
    expect(n0.parent).toBe(null);
    expect(n0.pose).toEqual(expect.objectContaining({ x: 25, y: 45 }));
    const n1 = (ops[1].args as { node: { id: string; pose: unknown } }).node;
    expect(n1.id).toBeTruthy();
    expect(n1.id).not.toBe(n0.id);
    expect(n1.pose).toEqual(expect.objectContaining({ x: 15, y: 25 }));

    // applyOps owns the commit — the scene's own fallback path is untouched.
    expect(scene.applyBatchLog).toHaveLength(0);
    expect(scene.addLog).toHaveLength(0);
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
    expect(scene.applyBatchLog).toHaveLength(0);
  });

  it('does not call applyOps when delta is zero', () => {
    const invoker = getOngoingInvoker(cloneAction);
    const applyOps = vi.fn<(ops: Op[], label: string) => void>();
    const ctx = makeCtx({
      selectionIds: ['a'],
      sceneNodes: { a: { pose: { x: 10, y: 10, width: 10, height: 10 } } },
      applyOps,
    });
    const handle = invoker.start(ctx, undefined);
    handle.onEnd!({ ...(ctx as InvocationCtx) }, 'commit');
    expect(applyOps).not.toHaveBeenCalled();
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
    // Verifies the dispatcher preview
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

describe('clone cursor', () => {
  it('declares the duplicate cursor for both the hover hint and the drag', () => {
    // Alt-drag-to-duplicate had no cursor anywhere in the kit. It needs no
    // modifier gate of its own: the select tool binds clone behind
    // `mods: { alt: true }`, so the hover pump predicts this action — and
    // shows this cursor — only while Alt is held over a body.
    expect(cloneAction.cursor).toBe('copy');
    expect(cloneAction.activeCursor).toBe('copy');
  });
});
