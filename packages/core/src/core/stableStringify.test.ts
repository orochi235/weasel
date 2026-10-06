import { describe, expect, it } from 'vitest';
import { stableStringify } from './stableStringify';

describe('stableStringify', () => {
  it('writes equal objects with differently ordered keys as one string', () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: [3, { f: 4, e: 5 }] } })).toBe(
      stableStringify({ a: { c: [3, { e: 5, f: 4 }], d: 2 }, b: 1 }),
    );
  });

  it('keeps array order', () => {
    expect(stableStringify([2, 1])).not.toBe(stableStringify([1, 2]));
  });
});
