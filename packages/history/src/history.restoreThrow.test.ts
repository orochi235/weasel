import { describe, expect, it } from 'vitest';
import { createHistory } from './history';
import type { Op } from './op';

type Cells = Record<string, number>;
const broken = new Set<string>();

/** Adds one: unlike a set, applying it twice is not applying it once. */
function bumpOp(key: string, by: number): Op {
  return {
    name: 'test:bump',
    args: { key, by },
    apply(a: Cells) {
      if (broken.has(key)) throw new Error(`cannot write ${key}`);
      a[key]! += by;
    },
    invert: () => bumpOp(key, -by),
  } as Op;
}

const rebuildOp = (_name: string, args: unknown) => {
  const { key, by } = args as { key: string; by: number };
  return bumpOp(key, by);
};

describe('History.restore — a step that throws on a restored entry', () => {
  it('undo leaves the state as it was', () => {
    broken.clear();
    const before: Cells = { a: 0, b: 0 };
    const source = createHistory(before);
    source.applyOps([bumpOp('a', 1), bumpOp('b', 1)], 'both');

    const cells: Cells = { a: 1, b: 1 };
    const history = createHistory(cells, { rebuildOp });
    history.restore(JSON.parse(JSON.stringify(source.serialize())));

    // Undo inverts b, then a: a fails after b was already inverted.
    broken.add('a');
    expect(() => history.undo()).toThrow('cannot write a');
    expect(cells).toEqual({ a: 1, b: 1 });

    broken.clear();
    history.undo();
    expect(cells).toEqual({ a: 0, b: 0 });
  });

  it('redo leaves the state as it was', () => {
    broken.clear();
    const source = createHistory({ a: 0, b: 0 });
    source.applyOps([bumpOp('a', 1), bumpOp('b', 1)], 'both');
    source.undo();

    const cells: Cells = { a: 0, b: 0 };
    const history = createHistory(cells, { rebuildOp });
    history.restore(source.serialize());

    broken.add('b');
    expect(() => history.redo()).toThrow('cannot write b');
    expect(cells).toEqual({ a: 0, b: 0 });
  });
});
