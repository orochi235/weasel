import { describe, expect, it } from 'vitest';
import { holderOf, outermost } from './tree';

// g ─ a ─ a1
//   └ b
// c
const parents: Record<string, string | null> = { g: null, a: 'g', a1: 'a', b: 'g', c: null };
const parentOf = (id: string) => parents[id];

describe('outermost', () => {
  it('drops ids an ancestor holds, whichever came first', () => {
    expect(outermost(['a1', 'g', 'c'], parentOf)).toEqual(['g', 'c']);
    expect(outermost(['g', 'b', 'a1'], parentOf)).toEqual(['g']);
  });

  it('keeps siblings and returns the same array when nothing is held', () => {
    const ids = ['a', 'b', 'c'];
    expect(outermost(ids, parentOf)).toBe(ids);
  });

  it('reaches past an unselected parent to a selected grandparent', () => {
    expect(outermost(['a1', 'g'], parentOf)).toEqual(['g']);
  });
});

describe('holderOf', () => {
  it('names the id itself, then its nearest selected ancestor, else null', () => {
    expect(holderOf(new Set(['a1']), 'a1', parentOf)).toBe('a1');
    expect(holderOf(new Set(['g']), 'a1', parentOf)).toBe('g');
    expect(holderOf(new Set(['g', 'a']), 'a1', parentOf)).toBe('a');
    expect(holderOf(new Set(['c']), 'a1', parentOf)).toBeNull();
  });
});

describe('a parentOf with a cycle', () => {
  const cyclic: Record<string, string> = { a: 'b', b: 'a', x: 'a' };
  const cyclicParentOf = (id: string) => cyclic[id];

  it('throws from holderOf rather than walking forever', () => {
    expect(() => holderOf(new Set(['z']), 'x', cyclicParentOf)).toThrow(RangeError);
    expect(holderOf(new Set(['b']), 'x', cyclicParentOf)).toBe('b');
  });

  it('throws from outermost rather than walking forever', () => {
    expect(() => outermost(['x', 'z'], cyclicParentOf)).toThrow(/cycle/);
  });
});
