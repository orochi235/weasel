import { describe, expect, it } from 'vitest';
import { createHistory } from '../createHistory';
import { createReorderOp, type ReorderDirection } from './index';

function adapter(initial = ['a', 'b', 'c', 'd']) {
  let order = initial.slice();
  return {
    self: {
      getParent: () => null,
      getChildren: () => order.slice(),
      setChildOrder: (_p: string | null, ids: string[]) => { order = ids.slice(); },
    },
    order: () => order.slice(),
  };
}

const DIRECTIONS: ReorderDirection[] = ['forward', 'backward', 'front', 'back'];

describe('reorder ops round-trip through History.serialize()', () => {
  it.each(DIRECTIONS)('%s keeps its undo entry in the snapshot', (direction) => {
    const a = adapter();
    const h = createHistory(a.self);
    h.applyOps([createReorderOp({ ids: ['b'], direction })], `Reorder ${direction}`);
    const snap = h.serialize();
    expect(snap.droppedEntries).toBe(0);
    expect(snap.undoStack.length).toBe(1);
  });

  it.each(DIRECTIONS)('%s undoes correctly after a restore', (direction) => {
    const a = adapter();
    const h = createHistory(a.self);
    h.applyOps([createReorderOp({ ids: ['b'], direction })], `Reorder ${direction}`);
    const moved = a.order();
    expect(moved).not.toEqual(['a', 'b', 'c', 'd']);

    // A fresh session: same adapter state, history rebuilt from the snapshot.
    const h2 = createHistory(a.self);
    h2.restore(h.serialize());
    expect(h2.canUndo()).toBe(true);
    h2.undo();
    expect(a.order()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('survives undo/redo/undo after a restore', () => {
    const a = adapter();
    const h = createHistory(a.self);
    h.applyOps([createReorderOp({ ids: ['a'], direction: 'front' })], 'Bring to front');
    const afterMove = a.order();

    const h2 = createHistory(a.self);
    h2.restore(h.serialize());
    h2.undo();
    expect(a.order()).toEqual(['a', 'b', 'c', 'd']);
    h2.redo();
    expect(a.order()).toEqual(afterMove);
    h2.undo();
    expect(a.order()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('a batch mixing a reorder with a named op keeps both', () => {
    const a = adapter();
    const h = createHistory(a.self);
    h.applyOps([createReorderOp({ ids: ['a'], direction: 'front' })], 'Bring to front');
    const snap = h.serialize();
    expect(snap.droppedEntries).toBe(0);
    expect(snap.undoStack[0].forwardOps.map((o) => o.name)).toEqual(['reorder']);
  });
});
