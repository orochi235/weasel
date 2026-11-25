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

/** A write of `to` to `key` that throws while `key=to` is listed. */
function writeOp(key: string, from: number, to: number, coalesceKey?: string): Op {
  return {
    name: 'test:write',
    args: { key, from, to },
    ...(coalesceKey ? { coalesceKey } : {}),
    apply(a: Cells) {
      if (broken.has(`${key}=${to}`)) throw new Error(`cannot write ${key}=${to}`);
      a[key] = to;
    },
    invert: () => writeOp(key, to, from, coalesceKey),
  } as Op;
}

describe('History — a failed step on a reordered coalesced entry sharing an op with the next', () => {
  /** A session committed as one entry: a run whose second batch lists its keys in another order, and a plain
   *  write of x, in the order `plainFirst` says. */
  function session(plainFirst: boolean) {
    broken.clear();
    let t = 0;
    const cells: Cells = { x: 0, y: 0 };
    const history = createHistory(cells, { coalesceWindowMs: 500, now: () => t });
    const j = history.beginJournal({ label: 'session' });
    const plain = () => { t += 1000; j.applyOps([writeOp('x', cells.x!, 9)], 'set'); t += 1000; };
    if (plainFirst) plain();
    j.applyOps([writeOp('x', cells.x!, 3, 'x'), writeOp('y', 0, 1, 'y')], 'drag');
    t += 10;
    j.applyOps([writeOp('y', 1, 2, 'y'), writeOp('x', 3, 5, 'x')], 'drag');
    if (!plainFirst) plain();
    j.commit('Edit');
    return { cells, history };
  }

  it('undo leaves the state where it began when the shared op runs last', () => {
    const { cells, history } = session(false);
    broken.add('y=0');
    expect(() => history.undo()).toThrow('cannot write y=0');
    expect(cells).toEqual({ x: 9, y: 2 });
  });

  it('undo leaves the state where it began when the shared op runs first', () => {
    const { cells, history } = session(true);
    broken.add('x=0');
    expect(() => history.undo()).toThrow('cannot write x=0');
    expect(cells).toEqual({ x: 5, y: 2 });
  });

  it('redo leaves the state where it began when the shared op runs first', () => {
    const { cells, history } = session(true);
    history.undo();
    broken.add('x=5');
    expect(() => history.redo()).toThrow('cannot write x=5');
    expect(cells).toEqual({ x: 0, y: 0 });
  });
});
