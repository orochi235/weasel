/**
 * Tests for `deleteAction` descriptor.
 */
import { describe, it, expect, vi } from 'vitest';
import { buildDeleteOps, deleteAction } from './delete';
import { createScene } from 'core/scene/scene';
import type { RectPose, Scene } from 'core/scene/types';
import type { ImmediateInvoker } from '../invoker';
import type { NodeId } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import type { Op } from 'core/ops/types';

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

  it('captures each node\'s host-array index in its delete op', () => {
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
    const byId = new Map(ops.map((o) => [(o.args as { node: { id: string } }).node.id, o.args as { index: number }]));
    expect(byId.get('c')!.index).toBe(0);
    expect(byId.get('a')!.index).toBe(0);
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
// Real scene. The stub above cannot model a cascade, which is why the throw
// below survived a green suite: `scene.remove` takes dependents with it, so an
// op naming one that an earlier op already took hits `unknown node id`.
// ---------------------------------------------------------------------------

const LAYERS = [{ id: 'main' as const }];
const leaf = { kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} } as const;

/** `Scene` is contravariant in `TPose` through `clipFromPose` / `derive`, so a
 *  concretely-typed scene never satisfies the action-facing `Scene<unknown,
 *  string, unknown>`. Same cast every other real-scene action test uses. */
function asActionScene(scene: unknown): Scene<unknown, string, unknown> {
  return scene as Scene<unknown, string, unknown>;
}

function makeCycleScene() {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS });
  const edge = asNodeId('edge');
  const a = scene.add({ ...leaf, dependsOn: [edge] });
  scene.add({ ...leaf, id: edge, dependsOn: [a] });
  return { scene, a, edge };
}

function makeEdgeScene() {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS });
  const a = scene.add(leaf);
  const b = scene.add(leaf);
  const edge = scene.add({ ...leaf, dependsOn: [a, b] });
  return { scene, a, b, edge };
}

describe('buildDeleteOps over a real scene', () => {
  it('emits one op for a node and an edge that derives from it', () => {
    const { scene, a, edge } = makeEdgeScene();
    const ops = buildDeleteOps(asActionScene(scene), [a, edge], 'Delete');
    expect(ops).toHaveLength(1);
    expect((ops[0].args as { node: { id: string } }).node.id).toBe(a);
  });

  it('emits one op for a container and one of its children', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS });
    const box = scene.add({ ...leaf, kind: 'container' });
    const child = scene.add({ ...leaf, parent: box });
    expect(buildDeleteOps(asActionScene(scene), [box, child], 'Delete')).toHaveLength(1);
  });

  it('emits one op for a node and a child of an edge that derives from it', () => {
    const { scene, a, b } = makeEdgeScene();
    const group = scene.add({ ...leaf, kind: 'container', dependsOn: [a, b] });
    const child = scene.add({ ...leaf, parent: group });
    // `child` is neither a descendant of `a` nor derived from it; it goes only
    // because `group` does. Walking one relation at a time never reaches `a`.
    expect(buildDeleteOps(asActionScene(scene), [a, child], 'Delete')).toHaveLength(1);
  });

  it('terminates, and still emits an op, on a dependency cycle', () => {
    const { scene, a } = makeCycleScene();
    expect(buildDeleteOps(asActionScene(scene), [a], 'Delete')).toHaveLength(1);
  });

  it('emits one op when both members of a cycle are selected', () => {
    const { scene, a, edge } = makeCycleScene();
    // Each reaches the other, so a rule that asks "does anything in the
    // selection cover me" filters both and the delete silently does nothing.
    expect(buildDeleteOps(asActionScene(scene), [a, edge], 'Delete')).toHaveLength(1);
  });

  it('emits one op for a three-member cycle', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS });
    const [x, y, z] = [asNodeId('x'), asNodeId('y'), asNodeId('z')];
    scene.add({ ...leaf, id: x, dependsOn: [z] });
    scene.add({ ...leaf, id: y, dependsOn: [x] });
    scene.add({ ...leaf, id: z, dependsOn: [y] });
    expect(buildDeleteOps(asActionScene(scene), [x, y, z], 'Delete')).toHaveLength(1);
  });

  it('emits one op for a container and the child it derives from', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS });
    const child = asNodeId('child');
    const box = scene.add({ ...leaf, kind: 'container', dependsOn: [child] });
    scene.add({ ...leaf, id: child, parent: box });
    // No `dependsOn` cycle at all — the loop closes through parent ∪ dependsOn,
    // which is the graph a cascade actually follows.
    expect(buildDeleteOps(asActionScene(scene), [box, child], 'Delete')).toHaveLength(1);
  });

  it('emits one op for a repeated id', () => {
    const { scene, a } = makeEdgeScene();
    expect(buildDeleteOps(asActionScene(scene), [a, a], 'Delete')).toHaveLength(1);
  });

  it('still deletes a node whose dependsOn names an id that is not in the scene', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS });
    const edge = scene.add({ ...leaf, dependsOn: [asNodeId('ghost')] });
    // `ghost` rides along in the selection but can never produce an op, so it
    // must not stand in for one and filter the node that names it. Both orders:
    // with the stale id first, treating it as spoken-for swallows the edge.
    expect(buildDeleteOps(asActionScene(scene), ['ghost', edge], 'Delete')).toHaveLength(1);
    expect(buildDeleteOps(asActionScene(scene), [edge, 'ghost'], 'Delete')).toHaveLength(1);
  });

  it('emits one op per independent root', () => {
    const { scene, a, b } = makeEdgeScene();
    expect(buildDeleteOps(asActionScene(scene), [a, b], 'Delete')).toHaveLength(2);
  });
});

describe('deleteAction over a real scene', () => {
  it('deletes a node and its edge selected together without throwing', () => {
    const { scene, a, b, edge } = makeEdgeScene();
    runDelete({ selection: makeSelection([a, edge]), scene });
    expect(scene.get(a)).toBeUndefined();
    expect(scene.get(edge)).toBeUndefined();
    expect(scene.get(b)).toBeDefined();
  });

  it('actually deletes both members of a cycle rather than silently no-opping', () => {
    const { scene, a, edge } = makeCycleScene();
    runDelete({ selection: makeSelection([a, edge]), scene });
    expect(scene.get(a)).toBeUndefined();
    expect(scene.get(edge)).toBeUndefined();
  });

  it('leaves history usable after deleting a node and its edge together', () => {
    const { scene, a } = makeEdgeScene();
    runDelete({ selection: makeSelection([a]), scene });
    expect(scene.canUndo()).toBe(true);
    scene.undo();
    expect(scene.get(a)).toBeDefined();
  });
});
