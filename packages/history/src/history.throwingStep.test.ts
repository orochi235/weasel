import { describe, it, expect } from 'vitest';
import { createHistory } from './history';
import type { Op } from './op';

type Cells = Record<string, number>;

/** Keys whose writes throw while listed. */
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

function open(options: Parameters<typeof createHistory>[1] = {}) {
  broken.clear();
  const cells: Cells = { a: 0, b: 0, c: 0 };
  return { cells, history: createHistory(cells, options) };
}

const depths = (h: ReturnType<typeof createHistory>) => [h.undoDepth(), h.redoDepth()];

describe('History — a step that throws', () => {
  it('undo leaves the entry on the undo stack and the state as it was', () => {
    const { cells, history } = open();
    history.applyOps([setOp('a', 0, 1), setOp('b', 0, 1), setOp('c', 0, 1)], 'all');

    // Undo inverts c, then b, then a: b fails after c was already inverted.
    broken.add('b');
    expect(() => history.undo()).toThrow('cannot write b');
    expect(cells).toEqual({ a: 1, b: 1, c: 1 });
    expect(depths(history)).toEqual([1, 0]);

    broken.clear();
    history.undo();
    expect(cells).toEqual({ a: 0, b: 0, c: 0 });
    history.redo();
    expect(cells).toEqual({ a: 1, b: 1, c: 1 });
  });

  it('redo leaves the entry on the redo stack and the state as it was', () => {
    const { cells, history } = open();
    history.applyOps([setOp('a', 0, 1), setOp('b', 0, 1), setOp('c', 0, 1)], 'all');
    history.undo();

    broken.add('b');
    expect(() => history.redo()).toThrow('cannot write b');
    expect(cells).toEqual({ a: 0, b: 0, c: 0 });
    expect(depths(history)).toEqual([0, 1]);

    broken.clear();
    history.redo();
    expect(cells).toEqual({ a: 1, b: 1, c: 1 });
    history.undo();
    expect(cells).toEqual({ a: 0, b: 0, c: 0 });
  });

  it('undo of a coalesced entry that throws restores the latest values', () => {
    let t = 0;
    const { cells, history } = open({ coalesceWindowMs: 500, now: () => t });
    history.applyOps([setOp('a', 0, 1), setOp('b', 0, 1)], 'drag');
    t += 10;
    history.applyOps([setOp('a', 1, 2), setOp('b', 1, 2)], 'drag');
    expect(history.undoDepth()).toBe(1);

    broken.add('a');
    expect(() => history.undo()).toThrow('cannot write a');
    expect(cells).toEqual({ a: 2, b: 2, c: 0 });
    expect(depths(history)).toEqual([1, 0]);

    broken.clear();
    history.undo();
    expect(cells).toEqual({ a: 0, b: 0, c: 0 });
    history.redo();
    expect(cells).toEqual({ a: 2, b: 2, c: 0 });
  });

  it('goto returns to where it started when a step on the way throws', () => {
    const { cells, history } = open();
    history.applyOps([setOp('a', 0, 1)], 'a');
    history.applyOps([setOp('b', 0, 1)], 'b');
    history.applyOps([setOp('c', 0, 1)], 'c');

    broken.add('a');
    expect(() => history.goto(0)).toThrow('cannot write a');
    expect(cells).toEqual({ a: 1, b: 1, c: 1 });
    expect(depths(history)).toEqual([3, 0]);

    broken.clear();
    history.goto(0);
    expect(cells).toEqual({ a: 0, b: 0, c: 0 });
    history.goto(3);
    expect(cells).toEqual({ a: 1, b: 1, c: 1 });
  });

  it('applyOps records nothing and reverts the ops that ran before the throw', () => {
    const { cells, history } = open();
    broken.add('c');
    expect(() => history.applyOps([setOp('a', 0, 1), setOp('b', 0, 1), setOp('c', 0, 1)], 'all')).toThrow('cannot write c');
    expect(cells).toEqual({ a: 0, b: 0, c: 0 });
    expect(depths(history)).toEqual([0, 0]);
  });

  it('a failed undo does not move the selection or the selection an entry restores', () => {
    let selection: readonly string[] = ['before'];
    const { history } = open({
      selection: { get: () => selection, set: (ids) => { selection = ids; } },
    });
    history.applyOps([setOp('a', 0, 1)], 'a');
    selection = ['after'];
    history.undo();
    history.redo();
    expect(selection).toEqual(['after']);

    selection = ['elsewhere'];
    broken.add('a');
    expect(() => history.undo()).toThrow();
    expect(selection).toEqual(['elsewhere']);
    expect(history.entries().undo[0]!.selectionAfter).toEqual(['after']);
  });
});
