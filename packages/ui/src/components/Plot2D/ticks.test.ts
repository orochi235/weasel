import { describe, expect, it } from 'vitest';
import { formatTick, niceStep, niceTicks, stepDecimals, tickDecimals } from './ticks';

describe('niceStep', () => {
  it('rounds up to 1, 2 or 5 times a power of ten', () => {
    expect(niceStep(0.7)).toBe(1);
    expect(niceStep(1)).toBe(1);
    expect(niceStep(1.3)).toBe(2);
    expect(niceStep(2.1)).toBe(5);
    expect(niceStep(6)).toBe(10);
    expect(niceStep(47.6)).toBe(50);
    expect(niceStep(0.0031)).toBeCloseTo(0.005, 12);
  });

  it('never returns less than it was asked for', () => {
    for (const rough of [0.013, 0.3, 3.3, 19, 201, 7777]) expect(niceStep(rough)).toBeGreaterThanOrEqual(rough);
  });
});

describe('stepDecimals', () => {
  it('is the places a multiple of the step needs', () => {
    expect(stepDecimals(50)).toBe(0);
    expect(stepDecimals(1)).toBe(0);
    expect(stepDecimals(0.5)).toBe(1);
    expect(stepDecimals(0.2)).toBe(1);
    expect(stepDecimals(0.05)).toBe(2);
    expect(stepDecimals(0.1 * 3)).toBe(1);
  });
});

describe('niceTicks', () => {
  it('fits three ticks into a 72px lane spaced 24px apart', () => {
    const t = niceTicks([-11.43, 131.43], 72, { minSpacing: 24 });
    expect(t.values).toEqual([0, 50, 100]);
    expect(t.step).toBe(50);
    expect(t.decimals).toBe(0);
  });

  it('keeps every gap at least minSpacing pixels', () => {
    const range: [number, number] = [-3.7, 912.2];
    for (const px of [40, 72, 150, 400]) {
      const t = niceTicks(range, px, { minSpacing: 24 });
      const pxPerUnit = px / (range[1] - range[0]);
      for (let i = 1; i < t.values.length; i++) {
        expect((t.values[i] - t.values[i - 1]) * pxPerUnit).toBeGreaterThanOrEqual(24);
      }
    }
  });

  it('grows denser as the plot grows taller', () => {
    const short = niceTicks([0, 1], 72, { minSpacing: 24 });
    const tall = niceTicks([0, 1], 480, { minSpacing: 24 });
    expect(tall.values.length).toBeGreaterThan(short.values.length);
  });

  it('shares one decimal count across the column and lands on exact values', () => {
    const t = niceTicks([-0.095, 1.095], 72, { minSpacing: 24 });
    expect(t.values).toEqual([0, 0.5, 1]);
    expect(t.decimals).toBe(1);
    const fine = niceTicks([0, 1], 480, { minSpacing: 24 });
    expect(fine.values).toContain(0.3);
    expect(fine.values).not.toContain(0.30000000000000004);
  });

  it('drops ticks closer than inset pixels to either edge', () => {
    // 0 and 100 land exactly on the edges.
    expect(niceTicks([0, 100], 100, { minSpacing: 20, inset: 4 }).values).toEqual([20, 40, 60, 80]);
    expect(niceTicks([0, 100], 100, { minSpacing: 20, inset: 0 }).values).toEqual([0, 20, 40, 60, 80, 100]);
  });

  it('reads a reversed range as the same span', () => {
    expect(niceTicks([100, 0], 100, { minSpacing: 20, inset: 0 }).values).toEqual([0, 20, 40, 60, 80, 100]);
  });

  it('returns nothing for a degenerate plot', () => {
    expect(niceTicks([0, 1], 0, { minSpacing: 24 }).values).toEqual([]);
    expect(niceTicks([5, 5], 72, { minSpacing: 24 }).values).toEqual([]);
    expect(niceTicks([0, Number.NaN], 72, { minSpacing: 24 }).values).toEqual([]);
    expect(niceTicks([0, 1], 72, { minSpacing: 0 }).values).toEqual([]);
  });
});

describe('tickDecimals', () => {
  it('is the most places any given value needs', () => {
    expect(tickDecimals([0, 10, 250])).toBe(0);
    expect(tickDecimals([0, 0.25, 1])).toBe(2);
    expect(tickDecimals([0.1 + 0.2])).toBe(1);
  });
});

describe('formatTick', () => {
  it('pads every label to the shared decimal count', () => {
    expect(formatTick(1, { decimals: 1, step: 0.5 })).toBe('1.0');
    expect(formatTick(0.5, { decimals: 1, step: 0.5 })).toBe('0.5');
    expect(formatTick(100, { decimals: 0, step: 50 })).toBe('100');
  });

  it('never prints a negative zero', () => {
    expect(formatTick(-0, { decimals: 1, step: 0.5 })).toBe('0.0');
    expect(formatTick(-1e-12, { decimals: 2, step: 0.05 })).toBe('0.00');
  });
});
