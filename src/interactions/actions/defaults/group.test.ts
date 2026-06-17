/**
 * Tests for groupAction / ungroupAction descriptors and groupAction behavior.
 */
import { describe, it, expect, vi } from 'vitest';
import { groupAction, ungroupAction } from './group';
import { createScene } from 'core/scene/scene';
import type { NodeId } from 'core/scene/types';
import type { Op } from 'core/ops/types';
import type { ImmediateInvoker } from '../invoker';

describe('groupAction (descriptor)', () => {
  it('id="group", label="Group"', () => {
    expect(groupAction.id).toBe('group');
    expect(groupAction.label).toBe('Group');
  });

  it('defaultBinding = { kind: "key", key: "g", mods: { mod: true } }', () => {
    expect(groupAction.defaultBinding).toEqual({ kind: 'key', key: 'g', mods: { mod: true } });
  });

  it('invoker.timing = "immediate"', () => {
    expect(groupAction.invoker?.timing).toBe('immediate');
  });
});

describe('ungroupAction (descriptor)', () => {
  it('id="ungroup", label="Ungroup"', () => {
    expect(ungroupAction.id).toBe('ungroup');
    expect(ungroupAction.label).toBe('Ungroup');
  });

  it('defaultBinding = { kind: "key", key: "g", mods: { mod: true, shift: true } }', () => {
    expect(ungroupAction.defaultBinding).toEqual({ kind: 'key', key: 'g', mods: { mod: true, shift: true } });
  });

  it('invoker.timing = "immediate"', () => {
    expect(ungroupAction.invoker?.timing).toBe('immediate');
  });
});

// ---------------------------------------------------------------------------
// Behavior tests
// ---------------------------------------------------------------------------

type Layer = 'main';
interface Data { label?: string }

function makeScene() {
  return createScene<Data, Layer>({ systemLayers: [{ id: 'main' }] });
}

/** Minimal selection stub backed by a mutable id list. */
function makeSelection(ids: NodeId[]) {
  let current = [...ids];
  return {
    get: () => [...current],
    set: (next: NodeId[]) => { current = [...next]; },
    current,
  };
}

describe('groupAction.run', () => {
  it('wraps a same-layer 2-node selection in a container holding both ids in order, with the union AABB pose', () => {
    const scene = makeScene();
    const a = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    const b = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 20, y: 30, width: 10, height: 10 }, data: {} });
    const selection = makeSelection([a, b]);

    (groupAction.invoker as ImmediateInvoker).run({ scene, selection } as never, undefined as never);

    const sel = selection.get();
    expect(sel).toHaveLength(1);
    const containerId = sel[0]!;
    const container = scene.get(containerId)!;
    expect(container.kind).toBe('container');
    expect(scene.childrenOf(containerId)).toEqual([a, b]);
    expect(container.pose).toEqual({ x: 0, y: 0, width: 30, height: 40 });
  });

  it('leaves member poses unchanged (absolute-pose model)', () => {
    const scene = makeScene();
    const a = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    const b = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 20, y: 30, width: 10, height: 10 }, data: {} });
    const selection = makeSelection([a, b]);

    (groupAction.invoker as ImmediateInvoker).run({ scene, selection } as never, undefined as never);

    expect(scene.get(a)!.pose).toEqual({ x: 0, y: 0, width: 10, height: 10 });
    expect(scene.get(b)!.pose).toEqual({ x: 20, y: 30, width: 10, height: 10 });
  });

  it('no-ops on an empty selection (no nodes added)', () => {
    const scene = makeScene();
    scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    const before = scene.nodes.size;
    const selection = makeSelection([]);

    (groupAction.invoker as ImmediateInvoker).run({ scene, selection } as never, undefined as never);

    expect(scene.nodes.size).toBe(before);
    expect(selection.get()).toEqual([]);
  });

  it('produces exactly one undo entry (single batch) without applyOps', () => {
    const scene = makeScene();
    const a = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    const b = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 20, y: 30, width: 10, height: 10 }, data: {} });
    const selection = makeSelection([a, b]);

    (groupAction.invoker as ImmediateInvoker).run({ scene, selection } as never, undefined as never);

    const containerId = selection.get()[0]!;
    expect(scene.get(containerId)!.kind).toBe('container');

    // One undo collapses the whole group operation (container removed, children
    // reparented back to root).
    scene.undo();
    expect(scene.get(containerId)).toBeUndefined();
    expect(scene.get(a)!.parent).toBe(null);
    expect(scene.get(b)!.parent).toBe(null);
  });
});

describe('groupAction.run — applyOps routing', () => {
  it('routes commit through the consumer applyOps hook once with insert + reparent ops + "Group" label, and still sets selection', () => {
    const scene = makeScene();
    const a = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    const b = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 20, y: 30, width: 10, height: 10 }, data: {} });
    const selection = makeSelection([a, b]);
    const applyOps = vi.fn<(ops: Op[], label: string) => void>();

    (groupAction.invoker as ImmediateInvoker).run({ scene, selection, applyOps } as never, undefined as never);

    // applyOps owns the commit — exactly one call with the right label.
    expect(applyOps).toHaveBeenCalledOnce();
    const [ops, label] = applyOps.mock.calls[0]!;
    expect(label).toBe('Group');

    // First op inserts the fresh container (kind=container, layer=main, union
    // AABB pose, parent=null since the two members share the root).
    expect(ops[0]!.name).toBe('insert');
    const containerNode = (ops[0]!.args as {
      node: { id: string; kind: string; layer: string; pose: unknown; parent: NodeId | null };
    }).node;
    expect(containerNode.id).toBeTruthy();
    expect(containerNode.kind).toBe('container');
    expect(containerNode.layer).toBe('main');
    expect(containerNode.parent).toBe(null);
    expect(containerNode.pose).toEqual({ x: 0, y: 0, width: 30, height: 40 });

    // Remaining ops reparent each selected id under the new container, in order.
    expect(ops).toHaveLength(3);
    expect(ops[1]!.name).toBe('reparent');
    expect(ops[2]!.name).toBe('reparent');
    const r1 = ops[1]!.args as { id: string; fromParentId: NodeId | null; toParentId: NodeId | null };
    const r2 = ops[2]!.args as { id: string; fromParentId: NodeId | null; toParentId: NodeId | null };
    expect(r1.id).toBe(a);
    expect(r1.fromParentId).toBe(null);
    expect(r1.toParentId).toBe(containerNode.id);
    expect(r2.id).toBe(b);
    expect(r2.fromParentId).toBe(null);
    expect(r2.toParentId).toBe(containerNode.id);

    // Selection still updates to the new container (selection is not an op).
    expect(selection.get()).toEqual([containerNode.id]);

    // The scene's own fallback path is untouched — applyOps owns the commit.
    expect(scene.get(a as NodeId)!.parent).toBe(null);
  });

  it('does not call applyOps on an empty selection', () => {
    const scene = makeScene();
    scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    const selection = makeSelection([]);
    const applyOps = vi.fn<(ops: Op[], label: string) => void>();

    (groupAction.invoker as ImmediateInvoker).run({ scene, selection, applyOps } as never, undefined as never);

    expect(applyOps).not.toHaveBeenCalled();
  });
});

describe('ungroupAction.run', () => {
  it('dissolves a container, reparenting its children to the container parent and selecting them', () => {
    const scene = makeScene();
    const a = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    const b = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 20, y: 30, width: 10, height: 10 }, data: {} });
    const selection = makeSelection([a, b]);

    // First group the two nodes, then ungroup the resulting container.
    (groupAction.invoker as ImmediateInvoker).run({ scene, selection } as never, undefined as never);
    const containerId = selection.get()[0]!;
    selection.set([containerId]);

    (ungroupAction.invoker as ImmediateInvoker).run({ scene, selection } as never, undefined as never);

    expect(scene.get(containerId)).toBeUndefined();
    expect(scene.get(a)!.parent).toBe(null);
    expect(scene.get(b)!.parent).toBe(null);
    expect(selection.get()).toEqual([a, b]);
  });

  it('no-ops on a selected leaf (non-container)', () => {
    const scene = makeScene();
    const a = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    const selection = makeSelection([a]);

    (ungroupAction.invoker as ImmediateInvoker).run({ scene, selection } as never, undefined as never);

    expect(scene.get(a)).toBeDefined();
    expect(scene.get(a)!.kind).toBe('leaf');
  });

  it('reparents a nested container and leaf up to the dissolved container parent', () => {
    const scene = makeScene();
    // Build container A holding leaf `a` and a nested container B (holding leaf `b`).
    const a = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    const b = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 20, y: 30, width: 10, height: 10 }, data: {} });

    // Group b into container B, then group a + B into container A.
    let selection = makeSelection([b]);
    (groupAction.invoker as ImmediateInvoker).run({ scene, selection } as never, undefined as never);
    const containerB = selection.get()[0]!;

    selection = makeSelection([a, containerB]);
    (groupAction.invoker as ImmediateInvoker).run({ scene, selection } as never, undefined as never);
    const containerA = selection.get()[0]!;

    selection.set([containerA]);
    (ungroupAction.invoker as ImmediateInvoker).run({ scene, selection } as never, undefined as never);

    expect(scene.get(containerA)).toBeUndefined();
    // a and B both float up to A's parent (root).
    expect(scene.get(a)!.parent).toBe(null);
    expect(scene.get(containerB)!.parent).toBe(null);
    // B itself is untouched: still a container still holding b.
    expect(scene.get(containerB)!.kind).toBe('container');
    expect(scene.childrenOf(containerB)).toEqual([b]);
    expect(selection.get()).toEqual([a, containerB]);
  });
});
