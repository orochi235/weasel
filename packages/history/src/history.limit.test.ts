import { describe, expect, it } from 'vitest';
import { createHistory } from './history';
import type { Op } from 'core/ops/types';

interface Cell { x: number }

/** Minimal invertible op over a shared cell. `key` opts into coalescing. */
function setX(cell: Cell, from: number, to: number, key?: string): Op {
  return {
    name: 'test:setX',
    args: { id: 'a', from, to },
    coalesceKey: key,
    apply: () => { cell.x = to; },
    invert: () => setX(cell, to, from, key),
  };
}

describe('historyLimit', () => {
  it('evicts the oldest entry when a push overflows the cap', () => {
    const cell: Cell = { x: 0 };
    const history = createHistory(null, { historyLimit: 2 });
    history.applyOps([setX(cell, 0, 1)], 'one');
    history.applyOps([setX(cell, 1, 2)], 'two');
    history.applyOps([setX(cell, 2, 3)], 'three');
    expect(history.entries().undo.map((e) => e.label)).toEqual(['two', 'three']);
    history.undo();
    history.undo();
    expect(history.canUndo()).toBe(false);
    // The evicted 'one' can no longer be undone: state rests at its to-state.
    expect(cell.x).toBe(1);
  });

  it('recordEntry also enforces the cap', () => {
    const cell: Cell = { x: 0 };
    const history = createHistory(null, { historyLimit: 1 });
    history.recordEntry([setX(cell, 0, 1)], 'one');
    history.recordEntry([setX(cell, 1, 2)], 'two');
    expect(history.entries().undo.map((e) => e.label)).toEqual(['two']);
  });
});
