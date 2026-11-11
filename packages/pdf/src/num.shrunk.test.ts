import { describe, expect, it } from 'vitest';
import { num } from './num';

// Shrunk from `num.pbt.test.ts` (2026-11-11).
describe('num, shrunk counterexamples', () => {
  it('keeps the zeros of a whole number written to no decimals', () => {
    expect(num(10, 0)).toBe('10');
    expect(num(100, 0)).toBe('100');
    expect(num(1e20, 0)).toBe('100000000000000000000');
    expect(num(-20.4, 0)).toBe('-20');
  });
});
