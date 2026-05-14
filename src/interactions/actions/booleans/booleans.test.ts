import { describe, it, expect } from 'vitest';
import { applyBooleanOp, type BooleansAdapter } from './booleans';
import type { Path } from 'features/paths/types';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';

function rect(id: string, x: number, y: number, w: number, h: number) {
  return {
    id: id as NodeId,
    path: { kind: 'rect', x, y, width: w, height: h } as Path,
  };
}

function makeAdapter(nodes: { id: NodeId; path: Path }[]): {
  adapter: BooleansAdapter;
  state: {
    inserted: { id: string; path: Path }[];
    removed: string[];
    selection: NodeId[];
    batches: { ops: Op[]; label: string }[];
  };
} {
  const state = {
    inserted: [] as { id: string; path: Path }[],
    removed: [] as string[],
    selection: [] as NodeId[],
    batches: [] as { ops: Op[]; label: string }[],
  };
  let nextId = 1;
  const idx = new Map(nodes.map((n, i) => [n.id, i]));
  const paths = new Map(nodes.map((n) => [n.id, n.path]));
  const adapter: BooleansAdapter = {
    getSelection: () => nodes.map((n) => n.id),
    getWorldPath: (id) => paths.get(id),
    compareZ: (a, b) => (idx.get(a) ?? 0) - (idx.get(b) ?? 0),
    createPathNode: (path, producedBy) => {
      const node = { id: `result_${nextId++}`, path };
      // Carry the path through for assertions.
      (node as any).path = path;
      (node as any).producedBy = producedBy;
      return node;
    },
    insertNode: (node) => state.inserted.push(node as any),
    removeNode: (id) => state.removed.push(id),
    setSelection: (ids) => { state.selection = ids; },
    applyOps: (ops, label) => {
      state.batches.push({ ops, label: label ?? '' });
      for (const op of ops) op.apply(adapter);
    },
  };
  return { adapter, state };
}

describe('applyBooleanOp', () => {
  it('union: deletes inputs, inserts one result, selects the result, one batch', () => {
    const h = makeAdapter([
      rect('a', 0, 0, 10, 10),
      rect('b', 5, 5, 10, 10),
    ]);
    const result = applyBooleanOp(h.adapter, 'union');
    expect(result.kind).toBe('applied');
    expect(h.state.batches).toHaveLength(1);
    expect(h.state.removed.sort()).toEqual(['a', 'b']);
    expect(h.state.inserted).toHaveLength(1);
    expect(h.state.selection).toEqual([h.state.inserted[0].id]);
  });

  it('captures full nodes via adapter.getNode so undo restores fields (regression)', () => {
    // Adapters that expose `getNode` should have the full obj round-trip
    // through the delete op's invert path. Without it, undo restores only
    // `{ id }` stubs and consumers reading `path`/`fill`/etc. crash.
    const fullA = { id: 'a' as NodeId, path: rect('a', 0, 0, 10, 10).path, fill: '#f00', custom: 'A' };
    const fullB = { id: 'b' as NodeId, path: rect('b', 5, 5, 10, 10).path, fill: '#0f0', custom: 'B' };
    const h = makeAdapter([
      { id: fullA.id, path: fullA.path },
      { id: fullB.id, path: fullB.path },
    ]);
    h.adapter.getNode = (id) => (id === fullA.id ? fullA : id === fullB.id ? fullB : undefined);
    applyBooleanOp(h.adapter, 'union');
    const deleteOps = h.state.batches[0].ops.filter((o) => o.label === undefined || !('insert' in o));
    // Invert each delete op and apply — should restore the full object.
    const restored: { id: string }[] = [];
    const restoringAdapter = {
      insertNode: (n: { id: string }) => restored.push(n),
      removeNode: () => { /* ignore — we're only asserting inserts here */ },
      setSelection: () => { /* select-op inverts also fire on undo */ },
    };
    for (const op of h.state.batches[0].ops) {
      const inv = op.invert();
      inv.apply(restoringAdapter);
    }
    const inserted = restored.find((n) => n.id === 'a');
    expect(inserted).toBeDefined();
    expect((inserted as typeof fullA).fill).toBe('#f00');
    expect((inserted as typeof fullA).custom).toBe('A');
    expect((inserted as typeof fullA).path).toBeDefined();
    void deleteOps;
  });

  it('no-op when selection has 0 paths', () => {
    const h = makeAdapter([]);
    const result = applyBooleanOp(h.adapter, 'union');
    expect(result.kind).toBe('noop');
    expect(h.state.batches).toHaveLength(0);
  });

  it('no-op when selection has only non-path nodes (getWorldPath returns undefined)', () => {
    const nodes = [{ id: 'g1' as NodeId, path: null as any }];
    const adapter: BooleansAdapter = {
      getSelection: () => nodes.map((n) => n.id),
      getWorldPath: () => undefined,
      compareZ: () => 0,
      createPathNode: () => ({ id: 'x' }),
    };
    const result = applyBooleanOp(adapter, 'union');
    expect(result.kind).toBe('noop');
  });
});

describe('applyBooleanOp — operation-specific behavior', () => {
  it('subtract: noop when < 2 paths selected', () => {
    const h = makeAdapter([rect('a', 0, 0, 10, 10)]);
    const result = applyBooleanOp(h.adapter, 'subtract');
    expect(result).toEqual({ kind: 'noop', reason: 'too-few-for-subtract' });
    expect(h.state.batches).toHaveLength(0);
  });

  it('subtract: result is back − front (z-order: back first)', () => {
    // 'a' at index 0 (back), 'b' at index 1 (front)
    const h = makeAdapter([
      rect('a', 0, 0, 10, 10),
      rect('b', 5, 5, 10, 10),
    ]);
    const result = applyBooleanOp(h.adapter, 'subtract');
    expect(result.kind).toBe('applied');
    expect(h.state.inserted).toHaveLength(1);
    // Sanity check the result has content.
    const path = (h.state.inserted[0] as any).path as { commands: Uint8Array };
    expect(path.commands.length).toBeGreaterThan(0);
  });

  it('intersect of disjoint inputs: noop with reason empty-result', () => {
    const h = makeAdapter([
      rect('a', 0, 0, 5, 5),
      rect('b', 10, 10, 5, 5),
    ]);
    const result = applyBooleanOp(h.adapter, 'intersect');
    expect(result).toEqual({ kind: 'noop', reason: 'empty-result' });
    expect(h.state.batches).toHaveLength(0);
  });

  it('divide: emits one node per region (3 for two overlapping rects)', () => {
    const h = makeAdapter([
      rect('a', 0, 0, 10, 10),
      rect('b', 5, 5, 10, 10),
    ]);
    const result = applyBooleanOp(h.adapter, 'divide');
    expect(result.kind).toBe('applied');
    expect(h.state.inserted).toHaveLength(3);
    expect(h.state.selection).toHaveLength(3);
  });

  it('passes the op kind to createPathNode as producedBy', () => {
    // Adapters that want layer-icon provenance (e.g. swillustrator) read
    // the second arg of createPathNode to tag the minted node.
    const h = makeAdapter([
      rect('a', 0, 0, 10, 10),
      rect('b', 5, 5, 10, 10),
    ]);
    applyBooleanOp(h.adapter, 'intersect');
    expect(h.state.inserted).toHaveLength(1);
    expect((h.state.inserted[0] as any).producedBy).toBe('intersect');
    const h2 = makeAdapter([
      rect('a', 0, 0, 10, 10),
      rect('b', 5, 5, 10, 10),
    ]);
    applyBooleanOp(h2.adapter, 'divide');
    for (const n of h2.state.inserted) {
      expect((n as any).producedBy).toBe('divide');
    }
  });

  it('one batch is dispatched per applied op (single undo step)', () => {
    const h = makeAdapter([
      rect('a', 0, 0, 10, 10),
      rect('b', 5, 5, 10, 10),
    ]);
    applyBooleanOp(h.adapter, 'union');
    expect(h.state.batches).toHaveLength(1);
    expect(h.state.batches[0].label).toBe('Union');
  });
});

// Z-order-aware harness: adapter exposes `getZOrder` plus the
// `ReorderAdapter` contract (`getChildren` / `setChildOrder`), so the kit
// emits a `createMoveToIndexOp` after the inserts to drop results into the
// topmost source's z-slot.
function makeZOrderedAdapter(initialOrder: { id: string; path: Path }[]) {
  // A single ordered list under parentId=null. Newly-inserted nodes append
  // to the end (mirrors a typical flat-array scene). `setChildOrder`
  // replaces the order outright.
  const order: string[] = initialOrder.map((n) => n.id);
  const paths = new Map(initialOrder.map((n) => [n.id, n.path]));
  let nextId = 1;
  const adapter: BooleansAdapter & {
    getChildren(parentId: string | null): string[];
    setChildOrder(parentId: string | null, ids: string[]): void;
    getParent(id: string): string | null;
  } = {
    getSelection: () => initialOrder.map((n) => n.id as NodeId),
    getWorldPath: (id) => paths.get(id),
    compareZ: (a, b) => order.indexOf(a) - order.indexOf(b),
    getZOrder: (id) => ({ parentId: null, index: order.indexOf(id) }),
    createPathNode: (path) => {
      const id = `result_${nextId++}`;
      paths.set(id, path);
      return { id };
    },
    insertNode: (node) => { if (!order.includes(node.id)) order.push(node.id); },
    removeNode: (id) => {
      const i = order.indexOf(id);
      if (i >= 0) order.splice(i, 1);
      paths.delete(id);
    },
    getChildren: (_parentId) => order.slice(),
    setChildOrder: (_parentId, ids) => { order.length = 0; order.push(...ids); },
    getParent: (_id) => null,
    setSelection: () => {},
    applyOps: (ops) => {
      for (const op of ops) op.apply(adapter);
    },
  };
  return { adapter, order };
}

describe('applyBooleanOp — z-position via getZOrder', () => {
  it('places the union result at the topmost source\'s z-slot', () => {
    // Bottom-up order: a, b, c, d. Selection: b and c. Topmost in
    // selection = c at index 2.
    const h = makeZOrderedAdapter([
      rect('a', 0, 0, 10, 10),
      rect('b', 0, 0, 10, 10),
      rect('c', 5, 5, 10, 10),
      rect('d', 0, 0, 10, 10),
    ]);
    // Restrict selection to b + c only.
    h.adapter.getSelection = () => ['b' as NodeId, 'c' as NodeId];
    applyBooleanOp(h.adapter, 'union');
    // After deletes + insert + move: order is [a, result, d] with the
    // result occupying what was c's slot (index 2 pre-batch → index 1
    // post-deletes since 'b' at index 1 was also removed).
    expect(h.order).toHaveLength(3); // a, result, d
    expect(h.order[0]).toBe('a');
    expect(h.order[2]).toBe('d');
    // The middle slot is the new result node.
    expect(h.order[1]).toMatch(/^result_/);
  });

  it('places all divide results contiguously at the topmost source\'s slot', () => {
    const h = makeZOrderedAdapter([
      rect('a', 0, 0, 10, 10),
      rect('b', 0, 0, 10, 10),  // back of selection
      rect('c', 5, 5, 10, 10),  // top of selection
      rect('d', 0, 0, 10, 10),
    ]);
    h.adapter.getSelection = () => ['b' as NodeId, 'c' as NodeId];
    applyBooleanOp(h.adapter, 'divide');
    // Three result nodes replace b + c at the topmost slot (c's original
    // index = 2 → index 1 after deletes). Final order: [a, r1, r2, r3, d].
    expect(h.order).toHaveLength(5);
    expect(h.order[0]).toBe('a');
    expect(h.order[4]).toBe('d');
    for (let i = 1; i <= 3; i++) expect(h.order[i]).toMatch(/^result_/);
  });

  it('falls back to default insert when adapter omits getZOrder', () => {
    // Same makeAdapter shape as the earlier tests — no getZOrder. The
    // result lands wherever insertNode defaults to (end of state.inserted).
    const h = makeAdapter([
      rect('a', 0, 0, 10, 10),
      rect('b', 5, 5, 10, 10),
    ]);
    expect(h.adapter.getZOrder).toBeUndefined();
    const result = applyBooleanOp(h.adapter, 'union');
    expect(result.kind).toBe('applied');
    // Confirm the batch doesn't include a MoveToIndex op (just delete +
    // insert + setSelection = 4 ops total).
    expect(h.state.batches[0].ops).toHaveLength(4);
  });
});
