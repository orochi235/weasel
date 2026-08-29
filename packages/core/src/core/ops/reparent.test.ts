import { describe, expect, it } from 'vitest';
import { createReparentOp } from './reparent';

describe('createReparentOp', () => {
  function makeAdapter() {
    const calls: { id: string; parentId: string | null }[] = [];
    return {
      setParent: (id: string, parentId: string | null) => calls.push({ id, parentId }),
      calls,
    };
  }

  it('apply calls setParent(id, toParentId)', () => {
    const op = createReparentOp({ id: 'a', fromParentId: 'old', toParentId: 'new' });
    const adapter = makeAdapter();
    op.apply(adapter as never);
    expect(adapter.calls).toEqual([{ id: 'a', parentId: 'new' }]);
  });

  it('invert swaps fromParentId and toParentId', () => {
    const op = createReparentOp({ id: 'a', fromParentId: 'old', toParentId: 'new' });
    const adapter = makeAdapter();
    op.invert().apply(adapter as never);
    expect(adapter.calls).toEqual([{ id: 'a', parentId: 'old' }]);
  });

  it('handles null parents on either side', () => {
    const adapter = makeAdapter();
    createReparentOp({ id: 'a', fromParentId: null, toParentId: 'new' }).invert().apply(adapter as never);
    createReparentOp({ id: 'b', fromParentId: 'old', toParentId: null }).apply(adapter as never);
    expect(adapter.calls).toEqual([
      { id: 'a', parentId: null },
      { id: 'b', parentId: null },
    ]);
  });

  it('default label is "Reparent"', () => {
    const op = createReparentOp({ id: 'a', fromParentId: null, toParentId: 'p' });
    expect(op.label).toBe('Reparent');
  });

  it('explicit label overrides default and propagates through invert', () => {
    const op = createReparentOp({ id: 'a', fromParentId: null, toParentId: 'p', label: 'Custom' });
    expect(op.label).toBe('Custom');
    expect(op.invert().label).toBe('Custom');
  });

  it('coalesceKey is stable per id', () => {
    const op1 = createReparentOp({ id: 'a', fromParentId: null, toParentId: 'p' });
    const op2 = createReparentOp({ id: 'a', fromParentId: 'p', toParentId: 'q' });
    expect(op1.coalesceKey).toBe('reparent:a');
    expect(op2.coalesceKey).toBe('reparent:a');
    expect(op1.invert().coalesceKey).toBe('reparent:a');
  });

  it('different ids get different coalesceKeys', () => {
    expect(createReparentOp({ id: 'a', fromParentId: null, toParentId: 'p' }).coalesceKey).toBe('reparent:a');
    expect(createReparentOp({ id: 'b', fromParentId: null, toParentId: 'p' }).coalesceKey).toBe('reparent:b');
  });
});

describe('createReparentOp — sibling index', () => {
  /** Ordered fake: setParent appends, setChildOrder rewrites a sibling list. */
  function makeOrderedAdapter(order: Record<string, string[]>) {
    return {
      order,
      setParent(id: string, parentId: string | null) {
        for (const key of Object.keys(order)) {
          const i = order[key].indexOf(id);
          if (i >= 0) order[key].splice(i, 1);
        }
        (order[parentId ?? 'ROOT'] ??= []).push(id);
      },
      getChildren: (parentId: string | null) => (order[parentId ?? 'ROOT'] ?? []).slice(),
      setChildOrder: (parentId: string | null, ids: string[]) => { order[parentId ?? 'ROOT'] = ids.slice(); },
    };
  }

  it('apply places the node at toIndex instead of appending', () => {
    const a = makeOrderedAdapter({ ROOT: ['x'], p: ['m', 'n'] });
    createReparentOp({ id: 'x', fromParentId: null, toParentId: 'p', toIndex: 1 }).apply(a as never);
    expect(a.order.p).toEqual(['m', 'x', 'n']);
  });

  it('invert restores the node to fromIndex', () => {
    const a = makeOrderedAdapter({ ROOT: ['a', 'b', 'c'], p: [] });
    const op = createReparentOp({ id: 'b', fromParentId: null, toParentId: 'p', fromIndex: 1 });
    op.apply(a as never);
    expect(a.order.ROOT).toEqual(['a', 'c']);

    op.invert().apply(a as never);
    expect(a.order.ROOT).toEqual(['a', 'b', 'c']);
  });

  it('invert swaps fromIndex and toIndex', () => {
    const op = createReparentOp({
      id: 'a', fromParentId: null, toParentId: 'p', fromIndex: 2, toIndex: 0,
    });
    expect(op.invert().args).toMatchObject({ fromIndex: 0, toIndex: 2 });
  });

  it('appends when no index is given', () => {
    const a = makeOrderedAdapter({ ROOT: ['x'], p: ['m', 'n'] });
    createReparentOp({ id: 'x', fromParentId: null, toParentId: 'p' }).apply(a as never);
    expect(a.order.p).toEqual(['m', 'n', 'x']);
  });

  it('ignores indices on an adapter with no ordering seam', () => {
    const calls: { id: string; parentId: string | null }[] = [];
    const a = { setParent: (id: string, parentId: string | null) => calls.push({ id, parentId }) };
    createReparentOp({ id: 'a', fromParentId: null, toParentId: 'p', toIndex: 0 }).apply(a as never);
    expect(calls).toEqual([{ id: 'a', parentId: 'p' }]);
  });
});
