import { describe, expect, it } from 'vitest';
import { sameValue } from './sameValue';

describe('sameValue', () => {
  it('compares plain objects by their own keys', () => {
    expect(sameValue({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(sameValue({ constructor: Object }, { other: 1 })).toBe(false);
    expect(sameValue({ toString: Object.prototype.toString }, { x: 1 })).toBe(false);
  });
});
