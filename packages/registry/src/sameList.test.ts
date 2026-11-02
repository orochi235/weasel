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

  it('compares elements by identity unless told otherwise', () => {
    expect(sameList([{ x: 1 }], [{ x: 1 }])).toBe(false);
    expect(sameList([NaN], [NaN])).toBe(false);
    expect(sameList([NaN, 1], [NaN, 1], Object.is)).toBe(true);
    expect(sameList([{ x: 1 }], [{ x: 1 }], (p, q) => p.x === q.x)).toBe(true);
  });
});
