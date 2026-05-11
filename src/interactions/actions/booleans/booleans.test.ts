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
    createPathNode: (path) => {
      const node = { id: `result_${nextId++}`, path };
      // Carry the path through for assertions.
      (node as any).path = path;
      return node;
    },
    insertNode: (node) => state.inserted.push(node as any),
    removeNode: (id) => state.removed.push(id),
    setSelection: (ids) => { state.selection = ids; },
    applyBatch: (ops, label) => {
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
