import { describe, it, expect } from 'vitest';
import { createHistory } from './history';
import type { Op } from './op';

type Cells = Record<string, number>;
const broken = new Set<string>();

function setOp(key: string, from: number, to: number): Op {
  return {
    name: 'test:set',
    args: { key, from, to },
    coalesceKey: key,
    apply(a: Cells) {
      if (broken.has(key)) throw new Error(`cannot write ${key}`);
      a[key] = to;
    },
    invert: () => setOp(key, to, from),
  } as Op;
}

/** An entry coalesced from `[a, b]` and then `[b, a]`: the second batch lists its keys in another order. */
function reordered() {
  broken.clear();
  const cells: Cells = { a: 0, b: 0 };
  const history = createHistory(cells, { coalesceWindowMs: 500, now: () => 0 });
  history.applyOps([setOp('a', 0, 1), setOp('b', 0, 1)], 'move');
  history.applyOps([setOp('b', 1, 2), setOp('a', 1, 2)], 'move');
  return { cells, history };
}

describe('History — a failed step on an entry coalesced from reordered batches', () => {
  it('undo leaves the latest values', () => {
    const { cells, history } = reordered();
    broken.add('a');
    expect(() => history.undo()).toThrow('cannot write a');
    expect(cells).toEqual({ a: 2, b: 2 });
    expect(history.undoDepth()).toBe(1);
  });

  it('redo leaves the values from before the entry', () => {
    const { cells, history } = reordered();
    history.undo();
    broken.add('a');
    expect(() => history.redo()).toThrow('cannot write a');
    expect(cells).toEqual({ a: 0, b: 0 });
    expect(history.redoDepth()).toBe(1);
  });
});
