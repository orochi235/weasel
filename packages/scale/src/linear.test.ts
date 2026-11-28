import { describe, expect, it } from 'vitest';
import { decimalsOf, formatNumber, linearScale, niceDomain, stepTicks } from './linear';
import { logScale } from './log';
import { formatTick, tickDecimals } from './tickFormat';
import { timeScale } from './time';
import { powScale } from './warp';

describe('a step with more digits than its magnitude', () => {
  it('needs every place its digits take', () => {
    expect(decimalsOf(0.25)).toBe(2);
    expect(decimalsOf(2.5)).toBe(1);
    expect(decimalsOf(0.125)).toBe(3);
  });

  it('ticks on its own grid and labels each tick apart', () => {
    expect(stepTicks(0, 1, 0.25)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(formatNumber(0.75, 0.25)).toBe('0.75');
  });
});

describe('ticks finer than 1e-20', () => {
  it('keep their digits', () => {
    const d = tickDecimals([1e-25, 2e-25, 3e-25]);
    expect(d).toBe(25);
    expect(formatTick(2e-25, { decimals: d, step: 0 })).toBe(`0.${'0'.repeat(24)}2`);
  });
});
