import { describe, expect, it } from 'vitest';
import { createHistory } from './history';
import type { Op } from './op';

type Cells = Record<string, number>;
const broken = new Set<string>();

/** Adds `by`: unlike a set, applying it twice is not applying it once. */
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

describe('Journal.commit — undoing the committed entry throws partway', () => {
  it('leaves the state as it was', () => {
    broken.clear();
    const cells: Cells = { a: 0, b: 0 };
    const parent = createHistory(cells);
    const j = parent.beginJournal({ label: 'session' });
    j.applyOps([bumpOp('a', 1)], 'a');
    j.applyOps([bumpOp('b', 1)], 'b');
    j.commit('session');

    // Undo inverts b, then a: a fails after b was already inverted.
    broken.add('a');
    expect(() => parent.undo()).toThrow('cannot write a');
    expect(cells).toEqual({ a: 1, b: 1 });

    broken.clear();
    parent.undo();
    expect(cells).toEqual({ a: 0, b: 0 });
    parent.redo();
    expect(cells).toEqual({ a: 1, b: 1 });
  });
});
