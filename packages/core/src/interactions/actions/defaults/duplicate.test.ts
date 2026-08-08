import { describe, it, expect, vi } from 'vitest';
import { duplicateAction } from './duplicate';
import type { ImmediateInvoker } from '../invoker';
import type { NodeId } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import type { Op } from 'core/ops/types';

interface StubNode { id: NodeId; kind: 'leaf' | 'container'; layer: string; pose: { x: number; y: number }; data: unknown; parent: NodeId | null }

function makeScene(spec: Array<[string, { parent?: string | null; kind?: 'leaf' | 'container'; x?: number; y?: number }]>) {
  const nodes = new Map<string, StubNode>();
  for (const [id, v] of spec) {
    nodes.set(id, {
      id: asNodeId(id),
      kind: v.kind ?? 'leaf',
      layer: 'main',
      pose: { x: v.x ?? 0, y: v.y ?? 0 },
      data: { tag: id },
      parent: v.parent != null ? asNodeId(v.parent) : null,
    });
  }
  return {
    get: (id: NodeId) => nodes.get(id),
    childrenOf: (id: NodeId) => [...nodes.values()].filter((n) => n.parent === id).map((n) => n.id),
    get roots() { return [...nodes.values()].filter((n) => n.parent == null).map((n) => n.id); },
    applyBatch: vi.fn(),
  };
}

function makeSelection(ids: string[]) {
  let current = ids;
  return { get: () => current, set: vi.fn((next: string[]) => { current = next; }) };
}

/** The node each insert op carries. */
function inserted(ops: Op[]): StubNode[] {
  return ops.map((o) => (o.args as { node: StubNode }).node);
}

describe('duplicateAction', () => {
  it('is Cmd/Ctrl+D and declares the `selection` its gate reads', () => {
    expect(duplicateAction.id).toBe('duplicate');
    expect(duplicateAction.defaultBinding).toEqual({ kind: 'key', key: 'd', mods: { mod: true } });
    expect(duplicateAction.requires).toContain('selection');
  });

  it('copies a leaf offset by 12, keeps its data and parent, and selects the copy', () => {
    const scene = makeScene([['a', { x: 100, y: 50 }]]);
    const selection = makeSelection(['a']);
    let committed: Op[] = [];
    const applyOps = vi.fn((ops: Op[]) => { committed = ops; });

    (duplicateAction.invoker as ImmediateInvoker).run({ scene, selection, applyOps } as never);

    const copies = inserted(committed);
    expect(copies).toHaveLength(1);
    expect(copies[0].pose).toEqual({ x: 112, y: 62 });
    expect(copies[0].data).toEqual({ tag: 'a' });
    expect(copies[0].parent).toBeNull();
    expect(copies[0].id).not.toBe('a');
    expect(selection.set).toHaveBeenCalledWith([copies[0].id]);
  });

  it('duplicates a container WITH its subtree, parented to the new copy', () => {
    // The whole point of the fix: a duplicated group must not come out empty.
    const scene = makeScene([
      ['g', { kind: 'container' }],
      ['a', { parent: 'g', x: 10, y: 10 }],
      ['b', { parent: 'g', x: 20, y: 20 }],
    ]);
    let committed: Op[] = [];
    (duplicateAction.invoker as ImmediateInvoker).run({
      scene, selection: makeSelection(['g']), applyOps: (ops: Op[]) => { committed = ops; },
    } as never);

    const copies = inserted(committed);
    expect(copies).toHaveLength(3);
    // Pre-order: the parent's insert precedes its children's.
    expect(copies[0].kind).toBe('container');
    expect(copies[1].parent).toBe(copies[0].id);
    expect(copies[2].parent).toBe(copies[0].id);
    // Absolute poses (no poseComposition dep): every node moves.
    expect(copies[1].pose).toEqual({ x: 22, y: 22 });
  });

  it('offsets only the roots when the consumer registered a poseComposition', () => {
    // Local poses: a child is relative, so offsetting the root already carries
    // it. Offsetting again would double the nudge.
    const scene = makeScene([
      ['g', { kind: 'container' }],
      ['a', { parent: 'g', x: 10, y: 10 }],
    ]);
    let committed: Op[] = [];
    (duplicateAction.invoker as ImmediateInvoker).run({
      scene,
      selection: makeSelection(['g']),
      applyOps: (ops: Op[]) => { committed = ops; },
      poseComposition: { compose: () => ({}), decompose: () => ({}) },
    } as never);

    expect(inserted(committed)[1].pose).toEqual({ x: 10, y: 10 });
  });

  it('does not double-copy a child selected alongside its container', () => {
    const scene = makeScene([
      ['g', { kind: 'container' }],
      ['a', { parent: 'g' }],
    ]);
    let committed: Op[] = [];
    (duplicateAction.invoker as ImmediateInvoker).run({
      scene, selection: makeSelection(['g', 'a']), applyOps: (ops: Op[]) => { committed = ops; },
    } as never);

    expect(inserted(committed)).toHaveLength(2);
  });

  it('falls back to scene.applyBatch without an applyOps hook', () => {
    const scene = makeScene([['a', {}]]);
    (duplicateAction.invoker as ImmediateInvoker).run({ scene, selection: makeSelection(['a']) } as never);
    expect(scene.applyBatch).toHaveBeenCalledWith(expect.any(Array), 'Duplicate', expect.anything());
  });

  it('no-ops on an empty selection', () => {
    const scene = makeScene([['a', {}]]);
    const applyOps = vi.fn();
    (duplicateAction.invoker as ImmediateInvoker).run({ scene, selection: makeSelection([]), applyOps } as never);
    expect(applyOps).not.toHaveBeenCalled();
  });
});
