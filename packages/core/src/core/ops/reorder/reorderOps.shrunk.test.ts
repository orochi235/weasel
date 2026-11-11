/** Counterexamples the second-pass z-order property tests shrank to, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import { createHistory } from '../createHistory';
import { createMoveToIndexOp } from './index';

describe('z-order ops, shrunk counterexamples', () => {
  it('a move to index Infinity, undone and reloaded from JSON, redoes to the top', () => {
    let order = ['a', 'b', 'c'];
    const adapter = { getParent: () => null, getChildren: () => order.slice(), setChildOrder: (_: unknown, ids: string[]) => { order = ids.slice(); } };
    const h = createHistory(adapter);
    h.applyOps([createMoveToIndexOp({ ids: ['a'], parentId: null, index: Infinity })], 'Move');
    expect(order).toEqual(['b', 'c', 'a']);
    h.undo();
    const reloaded = createHistory(adapter);
    reloaded.restore(JSON.parse(JSON.stringify(h.serialize())));
    reloaded.redo();
    expect(order).toEqual(['b', 'c', 'a']);
  });
});
