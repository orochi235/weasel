import { describe, expect, it } from 'vitest';
import { decimalsOf, linearScale, niceDomain } from './linear';
import { logScale } from './log';
import { formatTick, tickDecimals } from './tickFormat';
import { timeScale } from './time';
import { powScale } from './warp';

/** `spacedTicks` over `domain` laid `px` long. */
const spaced = (domain: readonly [number, number], px: number, minSpacing: number, inset?: number) =>
  linearScale({ domain, range: [0, px] }).spacedTicks({ minSpacing, inset });

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
      for (let i = 1; i < t.values.length; i++) expect(s.position(t.values[i]) - s.position(t.values[i - 1])).toBeGreaterThanOrEqual(24 - 1e-9);
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

  it('returns nothing where the step multiples are past counting, as ticks() does', () => {
    expect(spaced([1e17, 1e17 + 100], 100, 10).values).toEqual([]);
  });
});

describe('tickDecimals', () => {
  it('is the most places any given value needs', () => {
    expect(tickDecimals([0, 10, 250])).toBe(0);
    expect(tickDecimals([0, 0.25, 1])).toBe(2);
    expect(tickDecimals([0.1 + 0.2])).toBe(1);
  });

  it('counts small ticks to their own size', () => {
    expect(tickDecimals([1e-10, 2e-10, 3e-10])).toBe(10);
    expect(tickDecimals([0.0000000001, 0.0000000005])).toBe(10);
  });
});

describe('formatTick', () => {
  it('pads every label to the shared decimal count', () => {
    expect(formatTick(1, { decimals: 1, step: 0.5 })).toBe('1.0');
    expect(formatTick(0.5, { decimals: 1, step: 0.5 })).toBe('0.5');
    expect(formatTick(100, { decimals: 0, step: 50 })).toBe('100');
  });

  it('writes a value of 1e21 or more without an exponent, as a smaller one is', () => {
    expect(formatTick(1e21, { decimals: 1, step: 1e20 })).toBe('1000000000000000000000.0');
    expect(formatTick(-2e21, { decimals: 0, step: 1e21 })).toBe('-2000000000000000000000');
    expect(formatTick(1e23, { decimals: 0, step: 1e22 })).toBe('100000000000000000000000');
    expect(formatTick(-1.5e25, { decimals: 0, step: 1e24 })).toBe('-15000000000000000000000000');
    expect(linearScale({ domain: [0, 1e23], range: [0, 100] }).tickFormat()(1e23)).toBe('100000000000000000000000');
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
      for (const v of samples) expect(unit.invert(unit.position(v))).toBeCloseTo(v, 10);
      expect(unit.position(MIN)).toBeCloseTo(0, 12);
      expect(unit.position(MAX)).toBeCloseTo(1, 12);
    });

    it(`${name} is monotonic increasing`, () => {
      const at = samples.map((v) => unit.position(v));
      for (let i = 1; i < at.length; i++) expect(at[i]).toBeGreaterThan(at[i - 1]!);
    });
  }
});

describe('a tick count that is not a number', () => {
  it('takes the default count, as 0 / 0 spacing gives', () => {
    const linear = linearScale({ domain: [0, 1e6], range: [0, 100] });
    expect(linear.ticks(NaN)).toEqual(linear.ticks());
    expect(niceDomain([0, 7], NaN)).toEqual(niceDomain([0, 7]));
    const time = timeScale({ domain: [0, 30 * 86400000], range: [0, 100] });
    expect(time.ticks(NaN)).toEqual(time.ticks());
    expect(time.tickFormat(NaN)(0)).toBe(time.tickFormat()(0));
    const pow = powScale({ domain: [0, 100], range: [0, 100], exponent: 0.5 });
    expect(pow.ticks(NaN)).toEqual(pow.ticks());
    const log = logScale({ domain: [1, 1000], range: [0, 100] });
    expect(log.ticks(Infinity)).toEqual(log.ticks());
  });
});

describe('a log scale asked for few ticks', () => {
  it('keeps to powers when thinning leaves one, however many the domain holds', () => {
    const s = logScale({ domain: [2, 9e9], range: [0, 100] });
    expect(s.ticks(1)).toEqual([1e5]);
    expect(s.tickFormat(1)(1e5)).toBe('100000');
    expect(logScale({ domain: [2, 9e299], range: [0, 100] }).ticks(1).every((v) => Number.isInteger(Math.log10(v)))).toBe(true);
  });
});

describe('a domain of one value', () => {
  it('ticks on that value and labels it as it is', () => {
    const lin = linearScale({ domain: [0.3, 0.3], range: [0, 100] });
    expect(lin.ticks()).toEqual([0.3]);
    expect(lin.tickFormat()(0.3)).toBe('0.3');
    expect(linearScale({ domain: [1e300, 1e300], range: [0, 100] }).ticks()).toEqual([1e300]);
    const log = logScale({ domain: [150, 150], range: [0, 100] });
    expect(log.ticks()).toEqual([150]);
    expect(log.tickFormat()(150)).toBe('150');
    expect(logScale({ domain: [0.15, 0.15], range: [0, 100] }).tickFormat()(0.15)).toBe('0.15');
    expect(powScale({ domain: [0.3, 0.3], range: [0, 100], exponent: 2 }).ticks()).toEqual([0.3]);
  });
});
