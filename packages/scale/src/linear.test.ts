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

describe('stepTicks', () => {
  it('refuses a step that is not a positive number', () => {
    expect(() => stepTicks(0, 10, -1)).toThrow(RangeError);
    expect(() => stepTicks(0, 10, 0)).toThrow(RangeError);
    expect(() => stepTicks(0, 10, Number.NaN)).toThrow(RangeError);
  });

  it('refuses more ticks than its limit, unless the limit is raised', () => {
    expect(() => stepTicks(0, 1e6, 1e-9)).toThrow(RangeError);
    expect(() => stepTicks(0, 10, 1, 5)).toThrow(RangeError);
    expect(stepTicks(0, 10, 1, 11)).toHaveLength(11);
  });

  it("holds a scale's ticks to a bounded count however many are asked for", () => {
    expect(linearScale({ domain: [0, 1e6], range: [0, 1] }).ticks(1e15).length).toBeLessThanOrEqual(1_000_000);
  });
});

describe('spacedTicks', () => {
  it('holds the count to a bound for a spacing near zero', () => {
    const { values } = linearScale({ domain: [0, 1], range: [0, 1000] }).spacedTicks({ minSpacing: 1e-9 });
    expect(values.length).toBeGreaterThan(0);
    expect(values.length).toBeLessThanOrEqual(1_000_000);
  });

  it('refuses a negative inset', () => {
    expect(() => linearScale({ domain: [0, 1], range: [0, 1000] }).spacedTicks({ minSpacing: 10, inset: -1e9 })).toThrow(RangeError);
  });

  it('ticks a range wider than the largest double', () => {
    const { values } = linearScale({ domain: [0, 10], range: [-Number.MAX_VALUE, Number.MAX_VALUE] }).spacedTicks({ minSpacing: 1 });
    expect(values.length).toBeGreaterThan(0);
  });
});

describe('niceDomain of a single value', () => {
  it('widens the far end to a whole step too', () => {
    expect(niceDomain([7.3, 7.3])).toEqual(niceDomain([0, 7.3]));
    expect(niceDomain([-7.3, -7.3])).toEqual(niceDomain([-7.3, 0]));
    expect(linearScale({ domain: [7.3, 7.3], range: [0, 1], nice: 5 }).domain).toEqual([0, 8]);
  });
});

describe('inverting onto a range wider than the largest double', () => {
  const range = [-Number.MAX_VALUE, Number.MAX_VALUE] as const;
  it.each([
    ['linear', linearScale({ domain: [0, 10], range })],
    ['pow', powScale({ domain: [0, 10], range, exponent: 1 })],
    ['time', timeScale({ domain: [0, 10], range })],
    ['log', logScale({ domain: [1, 100], range })],
  ])('finds the midpoint and the far end on a %s scale', (_, s) => {
    expect(s.invert(0)).toBeCloseTo(s.kind === 'log' ? 10 : 5, 9);
    expect(s.invert(Number.MAX_VALUE)).toBe(s.domain[1]);
  });
});

describe('ticks finer than 1e-20', () => {
  it('keep their digits', () => {
    const d = tickDecimals([1e-25, 2e-25, 3e-25]);
    expect(d).toBe(25);
    expect(formatTick(2e-25, { decimals: d, step: 0 })).toBe(`0.${'0'.repeat(24)}2`);
  });
});
