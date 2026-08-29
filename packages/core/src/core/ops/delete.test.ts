import { describe, expect, it } from 'vitest';
import { createDeleteOp } from './delete';

interface Obj { id: string; value: number; parent: string | null }

/** Tree-backed fake adapter. `removeNode` cascades the subtree, matching
 *  `scene.remove` — a fake that drops a single id hides the very bug these
 *  tests exist for. */
function makeAdapter(initial: Obj[] = []) {
  const nodes = new Map<string, Obj>(initial.map((o) => [o.id, o]));
  const order: Record<string, string[]> = {};
  for (const o of initial) {
    const key = o.parent ?? 'ROOT';
    (order[key] ??= []).push(o.id);
  }
  const removes: string[] = [];
  const adapter = {
    getNode: (id: string) => nodes.get(id),
    getChildren: (parentId: string | null) => (order[parentId ?? 'ROOT'] ?? []).slice(),
    insertNode: (o: Obj, index?: number) => {
      nodes.set(o.id, o);
      const key = o.parent ?? 'ROOT';
      const list = (order[key] ??= []);
      list.splice(index ?? list.length, 0, o.id);
    },
    removeNode: (id: string) => {
      removes.push(id);
      const stack = [id];
      while (stack.length > 0) {
        const cur = stack.pop()!;
        stack.push(...(order[cur] ?? []));
        delete order[cur];
        const node = nodes.get(cur);
        if (node) {
          const siblings = order[node.parent ?? 'ROOT'];
          if (siblings) siblings.splice(siblings.indexOf(cur), 1);
        }
        nodes.delete(cur);
      }
    },
    nodes,
    order,
    removes,
  };
  return adapter;
}

const leaf = (id: string, value: number, parent: string | null = null): Obj => ({ id, value, parent });

describe('createDeleteOp', () => {
  it('applies as remove', () => {
    const adapter = makeAdapter([leaf('a', 1)]);
    createDeleteOp<Obj>({ node: adapter.getNode('a')!, index: 0 }).apply(adapter as never);
    expect(adapter.removes).toEqual(['a']);
  });

  it('inverts to an insert', () => {
    const adapter = makeAdapter([leaf('a', 1)]);
    const op = createDeleteOp<Obj>({ node: adapter.getNode('a')!, index: 0 });
    op.apply(adapter as never);
    op.invert().apply(adapter as never);
    expect([...adapter.nodes.values()]).toEqual([leaf('a', 1)]);
  });

  it('restores the whole subtree, not just the removed root', () => {
    const adapter = makeAdapter([
      leaf('g', 0),
      leaf('c1', 1, 'g'),
      leaf('c2', 2, 'g'),
      leaf('deep', 3, 'c1'),
    ]);
    const op = createDeleteOp<Obj>({ node: adapter.getNode('g')!, index: 0 });

    op.apply(adapter as never);
    expect(adapter.nodes.size).toBe(0);

    op.invert().apply(adapter as never);
    expect([...adapter.nodes.keys()].sort()).toEqual(['c1', 'c2', 'deep', 'g']);
    expect(adapter.getChildren('g')).toEqual(['c1', 'c2']);
    expect(adapter.getChildren('c1')).toEqual(['deep']);
  });

  it('re-inserts the root at its captured index', () => {
    const adapter = makeAdapter([leaf('a', 1), leaf('b', 2), leaf('c', 3)]);
    const op = createDeleteOp<Obj>({ node: adapter.getNode('b')!, index: 1 });
    op.apply(adapter as never);
    op.invert().apply(adapter as never);
    expect(adapter.getChildren(null)).toEqual(['a', 'b', 'c']);
  });

  it('mirrors the captured subtree into args so a rebuilt op can invert', () => {
    const adapter = makeAdapter([leaf('g', 0), leaf('c1', 1, 'g')]);
    const op = createDeleteOp<Obj>({ node: adapter.getNode('g')!, index: 0 });
    op.apply(adapter as never);

    const rebuilt = createDeleteOp<Obj>(op.args as never);
    rebuilt.invert().apply(adapter as never);
    expect(adapter.getChildren('g')).toEqual(['c1']);
  });

  it('inverting the inverse gives back a delete of the whole subtree', () => {
    const adapter = makeAdapter([leaf('g', 0), leaf('c1', 1, 'g')]);
    const op = createDeleteOp<Obj>({ node: adapter.getNode('g')!, index: 0 });
    op.apply(adapter as never);
    const inverse = op.invert();
    inverse.apply(adapter as never);
    inverse.invert().apply(adapter as never);
    expect(adapter.nodes.size).toBe(0);
  });

  it('skips descendants a non-cascading removeNode left in place', () => {
    const flat = makeAdapter([leaf('g', 0), leaf('c1', 1, 'g')]);
    flat.removeNode = (id: string) => { flat.nodes.delete(id); };
    const op = createDeleteOp<Obj>({ node: flat.getNode('g')!, index: 0 });

    op.apply(flat as never);
    expect([...flat.nodes.keys()]).toEqual(['c1']);

    op.invert().apply(flat as never);
    expect(flat.getChildren('g')).toEqual(['c1']);
  });

  it('leaves the subtree empty when the adapter cannot enumerate children', () => {
    const flat = {
      removeNode: () => {},
      insertNode: () => {},
    };
    const op = createDeleteOp<Obj>({ node: leaf('a', 1), index: 0 });
    op.apply(flat as never);
    expect(() => op.invert().apply(flat as never)).not.toThrow();
  });
});

describe('createDeleteOp — slot anchoring', () => {
  it('records the following sibling, and null when the node was last', () => {
    const adapter = makeAdapter([leaf('a', 1), leaf('b', 2), leaf('c', 3)]);
    const mid = createDeleteOp<Obj>({ node: adapter.getNode('b')!, index: 1 });
    const last = createDeleteOp<Obj>({ node: adapter.getNode('c')!, index: 2 });
    mid.apply(adapter as never);
    last.apply(adapter as never);

    expect((mid.args as { slot: { before?: string | null } }).slot.before).toBe('c');
    expect((last.args as { slot: { before?: string | null } }).slot.before).toBeNull();
  });

  it('distinguishes an unobserved slot from a tail slot across JSON', () => {
    const flat = {
      removeNode: () => {},
      insertNode: () => {},
    };
    const unobserved = createDeleteOp<Obj>({ node: leaf('a', 1), index: 0 });
    unobserved.apply(flat as never);

    const adapter = makeAdapter([leaf('a', 1), leaf('b', 2)]);
    const tail = createDeleteOp<Obj>({ node: adapter.getNode('b')!, index: 1 });
    tail.apply(adapter as never);

    const round = (op: { args?: unknown }): { slot: { before?: string | null } } =>
      JSON.parse(JSON.stringify(op.args));
    expect('before' in round(unobserved).slot).toBe(false);
    expect(round(tail).slot.before).toBeNull();
  });

  it('re-inserts before the anchor even when the list has shifted underneath', () => {
    const adapter = makeAdapter([leaf('a', 1), leaf('b', 2), leaf('c', 3), leaf('d', 4)]);
    const del = createDeleteOp<Obj>({ node: adapter.getNode('b')!, index: 1 });
    del.apply(adapter as never);
    // A separate edit removes a's slot, so b's recorded index 1 is now wrong.
    adapter.removeNode('a');
    expect(adapter.order.ROOT).toEqual(['c', 'd']);

    del.invert().apply(adapter as never);

    expect(adapter.order.ROOT).toEqual(['b', 'c', 'd']);
  });

  it('falls back to the recorded index when the anchor is gone too', () => {
    const adapter = makeAdapter([leaf('a', 1), leaf('b', 2), leaf('c', 3)]);
    const del = createDeleteOp<Obj>({ node: adapter.getNode('b')!, index: 1 });
    del.apply(adapter as never);
    adapter.removeNode('c');
    expect(adapter.order.ROOT).toEqual(['a']);

    del.invert().apply(adapter as never);

    expect(adapter.order.ROOT).toEqual(['a', 'b']);
  });

  it('appends when the node was last', () => {
    const adapter = makeAdapter([leaf('a', 1), leaf('b', 2), leaf('c', 3)]);
    const del = createDeleteOp<Obj>({ node: adapter.getNode('c')!, index: 2 });
    del.apply(adapter as never);
    adapter.removeNode('a');

    del.invert().apply(adapter as never);

    expect(adapter.order.ROOT).toEqual(['b', 'c']);
  });

  it('honors the supplied index on an adapter with no ordering seam', () => {
    const order: string[] = ['a', 'c'];
    const flat = {
      removeNode: (id: string) => { order.splice(order.indexOf(id), 1); },
      insertNode: (o: Obj, index?: number) => { order.splice(index ?? order.length, 0, o.id); },
    };
    createDeleteOp<Obj>({ node: leaf('b', 2), index: 1 }).invert().apply(flat as never);
    expect(order).toEqual(['a', 'b', 'c']);
  });
});
