import { describe, expect, it } from 'vitest';
import { decimalsOf, linearScale, niceStep } from './linear';
import { logScale } from './log';
import { formatTick, tickDecimals } from './tickFormat';

/** `spacedTicks` over `domain` laid `px` long. */
const spaced = (domain: readonly [number, number], px: number, minSpacing: number, inset?: number) =>
  linearScale({ domain, range: [0, px] }).spacedTicks({ minSpacing, inset });

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

describe('decimalsOf', () => {
  it('is the places a multiple of the step needs', () => {
    expect(decimalsOf(50)).toBe(0);
    expect(decimalsOf(1)).toBe(0);
    expect(decimalsOf(0.5)).toBe(1);
    expect(decimalsOf(0.2)).toBe(1);
    expect(decimalsOf(0.05)).toBe(2);
    expect(decimalsOf(0.1 * 3)).toBe(1);
  });

  it('is 0 for a step that is not a positive number', () => {
    expect(decimalsOf(0)).toBe(0);
    expect(decimalsOf(-1)).toBe(0);
    expect(decimalsOf(Number.NaN)).toBe(0);
  });
});

describe('spacedTicks', () => {
  it('fits three ticks into a 72px lane spaced 24px apart', () => {
    const t = spaced([-11.43, 131.43], 72, 24);
    expect(t.values).toEqual([0, 50, 100]);
    expect(t.step).toBe(50);
    expect(t.decimals).toBe(0);
  });

  it('keeps every gap at least minSpacing along the range', () => {
    const domain: [number, number] = [-3.7, 912.2];
    for (const px of [40, 72, 150, 400]) {
      const s = linearScale({ domain, range: [0, px] });
      const t = s.spacedTicks({ minSpacing: 24 });
      for (let i = 1; i < t.values.length; i++) expect(s.map(t.values[i]) - s.map(t.values[i - 1])).toBeGreaterThanOrEqual(24 - 1e-9);
    }
  });

  it('grows denser as the range grows longer', () => {
    expect(spaced([0, 1], 480, 24).values.length).toBeGreaterThan(spaced([0, 1], 72, 24).values.length);
  });

  it('reads the range either way round', () => {
    expect(linearScale({ domain: [0, 100], range: [100, 0] }).spacedTicks({ minSpacing: 20 }).values)
      .toEqual([0, 20, 40, 60, 80, 100]);
  });

  it('shares one decimal count across the column and lands on exact values', () => {
    const t = spaced([-0.095, 1.095], 72, 24);
    expect(t.values).toEqual([0, 0.5, 1]);
    expect(t.decimals).toBe(1);
    const fine = spaced([0, 1], 480, 24);
    expect(fine.values).toContain(0.3);
    expect(fine.values).not.toContain(0.30000000000000004);
    const timeline = spaced([0, 1], 640, 64);
    expect(timeline.step).toBeCloseTo(0.1, 12);
    expect(timeline.values).toContain(0.7);
  });

  it('drops ticks closer than inset to either end', () => {
    // 0 and 100 land exactly on the ends.
    expect(spaced([0, 100], 100, 20, 4).values).toEqual([20, 40, 60, 80]);
    expect(spaced([0, 100], 100, 20, 0).values).toEqual([0, 20, 40, 60, 80, 100]);
  });

  it('runs ascending over a reversed domain', () => {
    expect(spaced([100, 0], 100, 20).values).toEqual([0, 20, 40, 60, 80, 100]);
  });

  it('returns nothing for a degenerate axis', () => {
    expect(spaced([0, 1], 0, 24).values).toEqual([]);
    expect(spaced([5, 5], 72, 24).values).toEqual([]);
    expect(spaced([0, Number.NaN], 72, 24).values).toEqual([]);
    expect(spaced([0, 1], 72, 0).values).toEqual([]);
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

describe('a scale onto a unit track', () => {
  const MIN = 1 / 64;
  const MAX = 1 / 2;
  const samples = [MIN, 0.02, 0.05, 0.1, 0.3, MAX];

  for (const [name, make] of [['linear', linearScale], ['log', logScale]] as const) {
    const unit = make({ domain: [MIN, MAX], range: [0, 1] });

    it(`${name} round-trips a value and pins both ends`, () => {
      for (const v of samples) expect(unit.invert(unit.map(v))).toBeCloseTo(v, 10);
      expect(unit.map(MIN)).toBeCloseTo(0, 12);
      expect(unit.map(MAX)).toBeCloseTo(1, 12);
    });

    it(`${name} is monotonic increasing`, () => {
      const at = samples.map((v) => unit.map(v));
      for (let i = 1; i < at.length; i++) expect(at[i]).toBeGreaterThan(at[i - 1]!);
    });
  }
});
