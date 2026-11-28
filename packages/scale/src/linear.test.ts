import { describe, expect, it } from 'vitest';
import { formatTick, tickDecimals } from './tickFormat';

describe('ticks finer than 1e-20', () => {
  it('keep their digits', () => {
    const d = tickDecimals([1e-25, 2e-25, 3e-25]);
    expect(d).toBe(25);
    expect(formatTick(2e-25, { decimals: d, step: 0 })).toBe(`0.${'0'.repeat(24)}2`);
  });
});
