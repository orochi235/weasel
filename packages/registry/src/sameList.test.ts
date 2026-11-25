import { describe, expect, it } from 'vitest';
import { sameList } from './sameList';

describe('sameList', () => {
  it('holds for the same elements in the same order', () => {
    expect(sameList(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameList([], [])).toBe(true);
  });

  it('fails on a different length, element, or order', () => {
    expect(sameList(['a'], ['a', 'b'])).toBe(false);
    expect(sameList(['a', 'b'], ['a', 'c'])).toBe(false);
    expect(sameList(['a', 'b'], ['b', 'a'])).toBe(false);
  });

  it('compares elements with Object.is unless told otherwise', () => {
    expect(sameList([{ x: 1 }], [{ x: 1 }])).toBe(false);
    expect(sameList([NaN, 1], [NaN, 1])).toBe(true);
    expect(sameList([0], [-0])).toBe(false);
    expect(sameList([NaN], [NaN], (p, q) => p === q)).toBe(false);
    expect(sameList([{ x: 1 }], [{ x: 1 }], (p, q) => p.x === q.x)).toBe(true);
  });
});
