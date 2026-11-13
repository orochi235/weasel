import { RIGID_POSE_COMPOSITION } from 'core/scene/composePose';
import { describe, it, expect, vi } from 'vitest';
import { duplicateAction } from './duplicate';
import type { ImmediateInvoker } from '@weasel-js/routing';
import type { NodeId } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import type { Op } from 'core/ops/types';
import { BETWEEN_GESTURES } from '@weasel-js/routing';
import { lastTransform } from '../transform-again/memory';

interface StubNode { id: NodeId; kind: 'mark' | 'group'; layer: string; pose: { x: number; y: number }; data: unknown; parent: NodeId | null }

function makeScene(spec: Array<[string, { parent?: string | null; kind?: 'mark' | 'group'; x?: number; y?: number }]>) {
  const nodes = new Map<string, StubNode>();
  for (const [id, v] of spec) {
    nodes.set(id, {
      id: asNodeId(id),
      kind: v.kind ?? 'mark',
      layer: 'main',
      pose: { x: v.x ?? 0, y: v.y ?? 0 },
      data: { tag: id },
      parent: v.parent != null ? asNodeId(v.parent) : null,
    });
  }
  let minted = 0;
  return {
    get: (id: NodeId) => nodes.get(id),
    childrenOf: (id: NodeId) => [...nodes.values()].filter((n) => n.parent === id).map((n) => n.id),
    get roots() { return [...nodes.values()].filter((n) => n.parent == null).map((n) => n.id); },
    applyBatch: vi.fn((): boolean => true),
    mintId: () => asNodeId(`copy-${++minted}`),
    composition: RIGID_POSE_COMPOSITION as { closure: string },
  };
}

function makeSelection(ids: string[]) {
  let current = ids;
  return { get: () => current, set: vi.fn((next: string[]) => { current = next; }) };
}

/** The node each insert op carries. */
function inserted(ops: Op[]): StubNode[] {
  return ops.filter((o) => o.name === 'insert').map((o) => (o.args as { node: StubNode }).node);
}

describe('duplicateAction', () => {
  it('is Cmd/Ctrl+Shift+D and declares the `selection` its gate reads', () => {
    expect(duplicateAction.id).toBe('duplicate');
    expect(duplicateAction.defaultBinding).toEqual([{ spec: { kind: 'key', key: 'd', mods: { mod: true, shift: true }, phase: BETWEEN_GESTURES }, opts: { id: 'duplicate.key' } }]);
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
    expect((committed.at(-1)!.args as { to: readonly string[] }).to).toEqual([copies[0].id]);
  });

  it('duplicates a container WITH its subtree, parented to the new copy', () => {
    // The whole point of the fix: a duplicated group must not come out empty.
    const scene = makeScene([
      ['g', { kind: 'group' }],
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
    expect(copies[0].kind).toBe('group');
    expect(copies[1].parent).toBe(copies[0].id);
    expect(copies[2].parent).toBe(copies[0].id);
    // Stored in the copy's frame, which the root's offset carries.
    expect(copies[1].pose).toEqual({ x: 10, y: 10 });
  });

  it('does not double-copy a child selected alongside its container', () => {
    const scene = makeScene([
      ['g', { kind: 'group' }],
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

  it('records nothing for Transform Again when the scene refuses the copies', () => {
    const scene = makeScene([['a', {}]]);
    scene.applyBatch.mockReturnValue(false);
    (duplicateAction.invoker as ImmediateInvoker).run({ scene, selection: makeSelection(['a']) } as never);
    expect(lastTransform(scene)).toBeUndefined();
  });

  it('no-ops on an empty selection', () => {
    const scene = makeScene([['a', {}]]);
    const applyOps = vi.fn();
    (duplicateAction.invoker as ImmediateInvoker).run({ scene, selection: makeSelection([]), applyOps } as never);
    expect(applyOps).not.toHaveBeenCalled();
  });
});
