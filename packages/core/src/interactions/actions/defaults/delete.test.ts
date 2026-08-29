/**
 * Tests for `deleteAction` descriptor.
 */
import { describe, it, expect, vi } from 'vitest';
import { deleteAction } from './delete';
import type { ImmediateInvoker } from '../invoker';
import type { NodeId } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import type { Op } from 'core/ops/types';
import { createScene } from 'core/scene/scene';

// ---------------------------------------------------------------------------
// Stub scene — tracks removals, roots/children for index capture, and an
// `applyBatch` fallback so we can assert the non-`applyOps` commit path.
// ---------------------------------------------------------------------------

interface StubNode {
  id: NodeId;
  kind: 'leaf' | 'container';
  layer: string;
  pose: unknown;
  data: unknown;
  parent: NodeId | null;
}

function makeStubScene(
  initial: Record<string, { parent?: string | null; kind?: 'leaf' | 'container' }> = {},
  rootOrder?: string[],
) {
  const nodes = new Map<string, StubNode>();
  for (const [id, v] of Object.entries(initial)) {
    nodes.set(id, {
      id: asNodeId(id),
      kind: v.kind ?? 'leaf',
      layer: 'main',
      pose: { x: 0, y: 0, width: 10, height: 10 },
      data: {},
      parent: v.parent != null ? asNodeId(v.parent) : null,
    });
  }
  const removed: string[] = [];
  const batchLog: Array<{ label: string }> = [];
  const applyBatchLog: Array<{ ops: Op[]; label: string }> = [];

  const roots = (): NodeId[] =>
    (rootOrder ?? [...nodes.keys()].filter((id) => nodes.get(id)!.parent == null)).map(asNodeId);

  const scene = {
    get: (id: NodeId) => nodes.get(id),
    childrenOf: (id: NodeId) =>
      [...nodes.values()].filter((n) => n.parent === id).map((n) => n.id),
    get roots() { return roots(); },
    remove: vi.fn((id: NodeId) => {
      if (!nodes.has(id)) throw new Error(`no node ${id}`);
      removed.push(id);
      nodes.delete(id);
    }),
    add: vi.fn(),
    batch: vi.fn(<T>(label: string, fn: () => T): T => {
      batchLog.push({ label });
      return fn();
    }),
    applyBatch: vi.fn((ops: Op[], label: string, adapter: unknown) => {
      applyBatchLog.push({ ops, label });
      for (const op of ops) op.apply(adapter);
    }),
  };
  return { scene, nodes, removed, batchLog, applyBatchLog };
}

function makeSelection(ids: string[]) {
  return {
    get: () => ids.map(asNodeId),
    set: vi.fn(),
  };
}

function runDelete(deps: Record<string, unknown>) {
  (deleteAction.invoker as ImmediateInvoker).run(deps as Parameters<ImmediateInvoker['run']>[0]);
}

describe('deleteAction (descriptor)', () => {
  it('id="delete", label="Delete"', () => {
    expect(deleteAction.id).toBe('delete');
    expect(deleteAction.label).toBe('Delete');
  });

  it('defaultBinding = Delete/Backspace, gated to [*:initial]', () => {
    expect(deleteAction.defaultBinding).toEqual({
      kind: 'key',
      key: ['Delete', 'Backspace'],
      phase: [{ channel: '*', phase: 'initial' }],
    });
  });

  it('invoker.timing = "immediate"', () => {
    expect(deleteAction.invoker?.timing).toBe('immediate');
  });
});

describe('deleteAction commit routing', () => {
  it('routes through the consumer applyOps hook once with delete ops + "Delete" label', () => {
    const { scene } = makeStubScene({ a: {}, b: {} });
    const selection = makeSelection(['a', 'b']);
    const applyOps = vi.fn<(ops: Op[], label: string) => void>();

    runDelete({ selection, scene, applyOps });

    expect(applyOps).toHaveBeenCalledOnce();
    const [ops, label] = applyOps.mock.calls[0];
    expect(label).toBe('Delete');
    expect(ops).toHaveLength(2);
    for (const op of ops) expect(op.name).toBe('delete');
    expect((ops[0].args as { node: { id: string } }).node.id).toBe('a');
    expect((ops[1].args as { node: { id: string } }).node.id).toBe('b');
    // applyOps owns the commit — no direct scene mutation here.
    expect(scene.remove).not.toHaveBeenCalled();
    // Selection cleared after delete.
    expect(selection.set).toHaveBeenCalledWith([]);
  });

  it('captures each node\'s host-array slot in its delete op', () => {
    // a, b at root; c is a child of b.
    const { scene } = makeStubScene(
      { a: {}, b: {}, c: { parent: 'b' } },
      ['a', 'b'],
    );
    const selection = makeSelection(['c', 'a']);
    const applyOps = vi.fn<(ops: Op[], label: string) => void>();

    runDelete({ selection, scene, applyOps });

    const [ops] = applyOps.mock.calls[0];
    // c is index 0 among b's children; a is index 0 among roots.
    const byId = new Map(ops.map((o) => [
      (o.args as { node: { id: string } }).node.id,
      o.args as { slot: { index: number } },
    ]));
    expect(byId.get('c')!.slot.index).toBe(0);
    expect(byId.get('a')!.slot.index).toBe(0);
  });

  it('falls back to scene.applyBatch (one batch entry) when no applyOps is present', () => {
    const { scene, nodes, applyBatchLog } = makeStubScene({ a: {}, b: {} });
    const selection = makeSelection(['a', 'b']);

    runDelete({ selection, scene });

    // Exactly one applyBatch call (single undo entry), label "Delete".
    expect(scene.applyBatch).toHaveBeenCalledOnce();
    expect(applyBatchLog[0].label).toBe('Delete');
    // Scene reflects the mutation: both nodes removed via the adapter.
    expect(scene.remove).toHaveBeenCalledTimes(2);
    expect(nodes.has('a')).toBe(false);
    expect(nodes.has('b')).toBe(false);
    expect(selection.set).toHaveBeenCalledWith([]);
  });

  it('no-ops on empty selection', () => {
    const { scene } = makeStubScene({ a: {} });
    const selection = makeSelection([]);
    const applyOps = vi.fn<(ops: Op[], label: string) => void>();

    runDelete({ selection, scene, applyOps });

    expect(applyOps).not.toHaveBeenCalled();
    expect(scene.applyBatch).not.toHaveBeenCalled();
    expect(selection.set).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Real-Scene undo integration. The stub scene above cannot see this: its
// `remove` drops a single id, while `scene.remove` cascades the subtree.
// ---------------------------------------------------------------------------

describe('deleteAction.run — undo against a real Scene', () => {
  type Layer = 'main';

  function sceneFixture() {
    const scene = createScene<Record<string, never>, Layer>({ systemLayers: [{ id: 'main' }] });
    const pose = { x: 0, y: 0, width: 10, height: 10 };
    const group = scene.add({ kind: 'container', layer: 'main', pose, data: {} });
    const c1 = scene.add({ kind: 'leaf', layer: 'main', pose, data: {}, parent: group });
    const c2 = scene.add({ kind: 'leaf', layer: 'main', pose, data: {}, parent: group });
    return { scene, group, c1, c2 };
  }

  it('restores a deleted container together with its children', () => {
    const { scene, group, c1, c2 } = sceneFixture();
    const selection = makeSelection([group as string]);

    runDelete({ selection, scene });

    expect(scene.get(group)).toBeUndefined();
    expect(scene.get(c1)).toBeUndefined();

    scene.undo();

    expect(scene.get(group)).toBeDefined();
    expect(scene.childrenOf(group)).toEqual([c1, c2]);
    expect(scene.get(c1)!.parent).toBe(group);
    expect(scene.get(c2)!.parent).toBe(group);
  });

  it('restores a nested subtree, poses and all', () => {
    const scene = createScene<{ tag?: string }, 'main'>({ systemLayers: [{ id: 'main' }] });
    const pose = { x: 0, y: 0, width: 10, height: 10 };
    const outer = scene.add({ kind: 'container', layer: 'main', pose, data: {} });
    const inner = scene.add({ kind: 'container', layer: 'main', pose, data: {}, parent: outer });
    const deep = scene.add({
      kind: 'leaf', layer: 'main', pose: { x: 5, y: 6, width: 1, height: 2 },
      data: { tag: 'deep' }, parent: inner,
    });
    const selection = makeSelection([outer as string]);

    runDelete({ selection, scene });
    scene.undo();

    expect(scene.childrenOf(outer)).toEqual([inner]);
    expect(scene.childrenOf(inner)).toEqual([deep]);
    expect(scene.get(deep)!.pose).toEqual({ x: 5, y: 6, width: 1, height: 2 });
    expect(scene.get(deep)!.data).toEqual({ tag: 'deep' });
  });

  it('redo re-deletes the whole subtree', () => {
    const { scene, group, c1 } = sceneFixture();
    const selection = makeSelection([group as string]);

    runDelete({ selection, scene });
    scene.undo();
    scene.redo();

    expect(scene.get(group)).toBeUndefined();
    expect(scene.get(c1)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Multi-node undo. `History.invertEntry` replays a batch's inverses in
// REVERSE order, so a slot recorded as a bare index is replayed against a
// list that hasn't been refilled yet and clamps to the end.
// ---------------------------------------------------------------------------

describe('deleteAction.run — undo restores document order for a multi-node batch', () => {
  type Layer = 'main';

  function fiveRoots() {
    const scene = createScene<Record<string, never>, Layer>({ systemLayers: [{ id: 'main' }] });
    const pose = { x: 0, y: 0, width: 10, height: 10 };
    const mk = () => scene.add({ kind: 'leaf', layer: 'main', pose, data: {} });
    const [a, b, c, d, e] = [mk(), mk(), mk(), mk(), mk()];
    return { scene, a: a!, b: b!, c: c!, d: d!, e: e! };
  }

  it('restores a contiguous run', () => {
    const { scene, a, b, c, d, e } = fiveRoots();
    runDelete({ selection: makeSelection([b, c, d]), scene });
    expect([...scene.roots]).toEqual([a, e]);

    scene.undo();

    expect([...scene.roots]).toEqual([a, b, c, d, e]);
  });

  it('restores a scattered set', () => {
    const { scene, a, b, c, d, e } = fiveRoots();
    runDelete({ selection: makeSelection([b, d]), scene });
    expect([...scene.roots]).toEqual([a, c, e]);

    scene.undo();

    expect([...scene.roots]).toEqual([a, b, c, d, e]);
  });

  it('restores a run given in reverse selection order (each anchor also deleted)', () => {
    const { scene, a, b, c, d, e } = fiveRoots();
    runDelete({ selection: makeSelection([d, c, b]), scene });

    scene.undo();

    expect([...scene.roots]).toEqual([a, b, c, d, e]);
  });

  it('restores a run that includes the last sibling', () => {
    const { scene, a, b, c, d, e } = fiveRoots();
    runDelete({ selection: makeSelection([c, d, e]), scene });
    expect([...scene.roots]).toEqual([a, b]);

    scene.undo();

    expect([...scene.roots]).toEqual([a, b, c, d, e]);
  });

  it('redo re-removes the batch, and a second undo restores order again', () => {
    const { scene, a, b, c, d, e } = fiveRoots();
    runDelete({ selection: makeSelection([b, c, d]), scene });
    scene.undo();
    scene.redo();
    expect([...scene.roots]).toEqual([a, e]);

    scene.undo();

    expect([...scene.roots]).toEqual([a, b, c, d, e]);
  });

  it('restores children of a container in order', () => {
    const scene = createScene<Record<string, never>, Layer>({ systemLayers: [{ id: 'main' }] });
    const pose = { x: 0, y: 0, width: 10, height: 10 };
    const box = scene.add({ kind: 'container', layer: 'main', pose, data: {} });
    const mk = () => scene.add({ kind: 'leaf', layer: 'main', pose, data: {}, parent: box });
    const [a, b, c, d, e] = [mk(), mk(), mk(), mk(), mk()];

    runDelete({ selection: makeSelection([b!, c!, d!]), scene });
    expect([...scene.childrenOf(box)]).toEqual([a, e]);

    scene.undo();

    expect([...scene.childrenOf(box)]).toEqual([a, b, c, d, e]);
  });
});
