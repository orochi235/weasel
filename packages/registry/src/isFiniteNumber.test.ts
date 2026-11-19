import { describe, expect, it } from 'vitest';
import { isFiniteNumber } from './isFiniteNumber';

describe('isFiniteNumber', () => {
  it('holds for finite numbers, zero of either sign included', () => {
    for (const v of [0, -0, 1, -2.5, Number.MAX_VALUE, Number.MIN_VALUE]) expect(isFiniteNumber(v), String(v)).toBe(true);
  });

  it('refuses NaN, the infinities, and anything not a number', () => {
    for (const v of [NaN, Infinity, -Infinity, '1', null, undefined, 1n, {}, [1], new Number(1)]) {
      expect(isFiniteNumber(v), String(v)).toBe(false);
    }
  });
});
