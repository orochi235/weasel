import { describe, expect, it } from 'vitest';
import { bandScale } from './band';
import { formatNumber, linearScale, niceDomain, tickStep } from './linear';
import { logScale } from './log';
import { ordinalScale } from './ordinal';
import { timeScale } from './time';

describe('linearScale', () => {
  const s = linearScale({ domain: [0, 100], range: [400, 0] });

  it('maps proportionally and inverts', () => {
    expect(s.map(0)).toBe(400);
    expect(s.map(25)).toBe(300);
    expect(s.position(100)).toBe(0);
    expect(s.invert(200)).toBe(50);
  });

  it('ticks on round steps of 1, 2 or 5', () => {
    expect(s.ticks()).toEqual([0, 20, 40, 60, 80, 100]);
    expect(s.ticks(10)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(linearScale({ domain: [0, 1], range: [0, 1] }).ticks()).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
    expect(tickStep(0, 8, 5)).toBe(2);
  });

  it('formats to its step, without trailing zeros', () => {
    expect(linearScale({ domain: [0, 1], range: [0, 1] }).format(0.4)).toBe('0.4');
    expect(s.format(60)).toBe('60');
    expect(formatNumber(2.5, 0.5)).toBe('2.5');
    expect(formatNumber(3, 0.5)).toBe('3');
    expect(formatNumber(1e21, 1e20)).toBe('1000000000000000000000');
    expect(formatNumber(-0.04, 0.1)).toBe('0');
    expect(formatNumber(-0.3, 1)).toBe('0');
    expect(formatNumber(-0.3, 0.1)).toBe('-0.3');
    const big = logScale({ domain: [1e20, 1e22], range: [0, 1] });
    expect(big.ticks(2).map((v) => big.format(v).length)).toEqual([21, 22, 23]);
  });

  it('formats ticks to the step of the count they were asked for', () => {
    const unit = linearScale({ domain: [0, 1], range: [0, 1] });
    expect(unit.ticks(20).slice(0, 3).map(unit.tickFormat(20))).toEqual(['0', '0.05', '0.1']);
  });

  it('ticks and labels a domain finer than 1e-20', () => {
    const tiny = linearScale({ domain: [0, 1e-25], range: [0, 1] });
    expect(tiny.ticks()).toEqual([0, 2e-26, 4e-26, 6e-26, 8e-26, 1e-25]);
    expect(tiny.format(2e-26)).toBe('0.00000000000000000000000002');
    expect(logScale({ domain: [1e-25, 1e-22], range: [0, 1] }).format(1e-24)).toBe('0.000000000000000000000001');
  });

  it('ticks an infinite domain with none, and one spanning nearly every double with a few', () => {
    expect(linearScale({ domain: [0, Infinity], range: [0, 1] }).ticks()).toEqual([]);
    expect(linearScale({ domain: [Number.NaN, 1], range: [0, 1] }).ticks()).toEqual([]);
    expect(linearScale({ domain: [-1e308, 1e308], range: [0, 1] }).ticks()).toEqual([-1e308, -5e307, 0, 5e307, 1e308]);
  });

  it('keeps a replaced format in the formatter for any tick count', () => {
    const pct = (v: number) => `${v}%`;
    expect({ ...linearScale({ domain: [0, 1], range: [0, 1] }), format: pct }.tickFormat(20)(0.05)).toBe('0.05%');
    expect({ ...logScale({ domain: [1, 100], range: [0, 1] }), format: pct }.tickFormat()(10)).toBe('10%');
    expect({ ...timeScale({ domain: [0, 864e5], range: [0, 1] }), format: () => 'T' }.tickFormat(30)(0)).toBe('T');
    expect({ ...bandScale({ domain: ['a'], range: [0, 1] }), format: (k: string) => k.toUpperCase() }.tickFormat()('a')).toBe('A');
  });

  it('widens a nice domain to whole steps', () => {
    expect(niceDomain([3, 97])).toEqual([0, 100]);
    expect(niceDomain([-13, 42])).toEqual([-20, 50]);
    expect(linearScale({ domain: [0.12, 0.88], range: [0, 1], nice: 5 }).domain).toEqual([0, 1]);
  });

  it('keeps an end where its whole step would overflow to infinity or round in to nothing', () => {
    expect(niceDomain([0, 1.7e308])).toEqual([0, 1.7e308]);
    expect(niceDomain([-1.7e308, 1.7e308])).toEqual([-1.7e308, 1.7e308]);
    expect(niceDomain([0, 5e-324])).toEqual([0, 5e-324]);
    expect(linearScale({ domain: [0, 1.7e308], range: [0, 100], nice: 5 }).map(1e308)).toBeCloseTo(58.8, 1);
  });
});

describe('logScale', () => {
  const s = logScale({ domain: [1, 1000], range: [0, 300] });

  it('maps each decade the same distance', () => {
    expect(s.map(1)).toBe(0);
    expect(s.map(10)).toBeCloseTo(100);
    expect(s.map(100)).toBeCloseTo(200);
    expect(s.invert(200)).toBeCloseTo(100);
  });

  it('ticks on powers, with 2s and 5s over a short span', () => {
    expect(s.ticks()).toEqual([1, 10, 100, 1000]);
    expect(logScale({ domain: [1, 100], range: [0, 1] }).ticks()).toEqual([1, 2, 5, 10, 20, 50, 100]);
    expect(logScale({ domain: [1, 1e8], range: [0, 1] }).ticks()).toEqual([1, 10, 100, 1000, 1e4, 1e5, 1e6, 1e7, 1e8]);
  });

  it('formats plainly', () => {
    expect(s.format(1000)).toBe('1000');
    expect(s.format(0.05)).toBe('0.05');
  });

  it('labels the fractional powers of a base other than 10 exactly', () => {
    const two = logScale({ domain: [0.125, 8], range: [0, 1], base: 2 });
    expect(two.ticks().map(two.tickFormat())).toEqual(['0.125', '0.25', '0.5', '1', '2', '4', '8']);
  });

  it('ticks an infinite domain with none', () => {
    expect(logScale({ domain: [1, Infinity], range: [0, 1] }).ticks()).toEqual([]);
  });

  it('refuses a base no logarithm is taken in', () => {
    for (const base of [1, 0, -2, Infinity, Number.NaN]) {
      expect(() => logScale({ domain: [1, 10], range: [0, 1], base })).toThrow(/base/);
    }
  });

  it('throws on a domain that does not lie above zero', () => {
    expect(() => logScale({ domain: [0, 10], range: [0, 1] })).toThrow(/above zero/);
  });
});

describe('bandScale', () => {
  const s = bandScale({ domain: ['a', 'b', 'c', 'd'], range: [0, 400], paddingInner: 0.2, paddingOuter: 0.1 });

  it('cuts the range into equal bands with padding', () => {
    expect(s.step).toBeCloseTo(100);
    expect(s.bandwidth).toBeCloseTo(80);
    expect(s.start('a')).toBeCloseTo(10);
    expect(s.start('d')).toBeCloseTo(310);
    expect(s.position('b')).toBeCloseTo(150);
    expect(s.start('zz')).toBeNaN();
  });

  it('inverts to the nearest band', () => {
    expect(s.invert(150)).toBe('b');
    expect(s.invert(-50)).toBe('a');
    expect(s.invert(999)).toBe('d');
  });

  it('inverts a zero-width range to a key, as every band sits at that point', () => {
    const flat = bandScale({ domain: ['a', 'b'], range: [5, 5] });
    expect(flat.invert(5)).toBe('a');
    expect(flat.invert(9)).toBe('a');
  });

  it('ticks and formats its categories', () => {
    expect(s.ticks()).toEqual(['a', 'b', 'c', 'd']);
    expect(s.format('c')).toBe('c');
  });

  it('runs either way round', () => {
    const up = bandScale({ domain: ['a', 'b'], range: [200, 0], paddingInner: 0, paddingOuter: 0 });
    expect(up.position('a')).toBeCloseTo(150);
    expect(up.start('a')).toBeCloseTo(100);
    expect(up.invert(40)).toBe('b');
  });
});

describe('timeScale', () => {
  const day = 24 * 3600 * 1000;
  const jan1 = Date.UTC(2026, 0, 1);

  it('maps instants proportionally', () => {
    const s = timeScale({ domain: [jan1, jan1 + 10 * day], range: [0, 100] });
    expect(s.map(jan1 + 5 * day)).toBe(50);
    expect(s.invert(10)).toBe(jan1 + day);
  });

  it('ticks on whole days and labels them as dates', () => {
    const s = timeScale({ domain: [jan1, jan1 + 10 * day], range: [0, 100] });
    expect(s.ticks().map(s.format)).toEqual(['2026-01-01', '2026-01-03', '2026-01-05', '2026-01-07', '2026-01-09', '2026-01-11'].slice(0, s.ticks().length));
    expect(s.ticks()[0]).toBe(jan1);
  });

  it('ticks on calendar months and years', () => {
    const months = timeScale({ domain: [jan1, Date.UTC(2026, 6, 1)], range: [0, 1] });
    expect(months.ticks().map(months.format)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07']);
    const years = timeScale({ domain: [jan1, Date.UTC(2031, 0, 1)], range: [0, 1] });
    expect(years.ticks().map(years.format)).toEqual(['2026', '2027', '2028', '2029', '2030', '2031']);
  });

  it('labels a denser tick count to its own unit', () => {
    const s = timeScale({ domain: [jan1, jan1 + 20 * day], range: [0, 1] });
    expect(s.ticks(100).slice(0, 3).map(s.tickFormat(100))).toEqual(['2026-01-01', '06:00', '12:00']);
  });

  it('ticks a span of decades on 1, 2 or 5 times a power of ten years, about as many as asked for', () => {
    for (const years of [8, 15, 25, 40, 60, 300]) {
      const s = timeScale({ domain: [jan1, Date.UTC(2026 + years, 0, 1)], range: [0, 1] });
      expect(s.ticks().length).toBeGreaterThanOrEqual(3);
      expect(s.ticks().length).toBeLessThanOrEqual(11);
    }
    const forty = timeScale({ domain: [jan1, Date.UTC(2066, 0, 1)], range: [0, 1] });
    expect(forty.ticks().map(forty.format)).toEqual(['2030', '2040', '2050', '2060']);
  });

  it('ticks centuries before the year 100 in order', () => {
    const at = (year: number) => new Date(0).setUTCFullYear(year, 0, 1);
    const s = timeScale({ domain: [at(0), at(2000)], range: [0, 1] });
    const years = s.ticks().map((t) => new Date(t).getUTCFullYear());
    expect(years[0]).toBe(0);
    expect(years).toEqual([...years].sort((a, b) => a - b));
  });

  it('ticks an infinite domain with none', () => {
    expect(timeScale({ domain: [jan1, Infinity], range: [0, 1] }).ticks()).toEqual([]);
  });

  it('ticks a domain reaching past the instants a Date holds, without hanging', () => {
    const ticks = timeScale({ domain: [1e16, 2e16], range: [0, 1] }).ticks();
    expect(ticks).toEqual([]);
    const wide = timeScale({ domain: [0, 2e16], range: [0, 1] }).ticks();
    expect(wide.length).toBeGreaterThan(0);
    expect(wide.every((t) => Number.isFinite(t) && t <= 8.64e15)).toBe(true);
    expect(timeScale({ domain: [0, 1e300], range: [0, 1] }).ticks().every(Number.isFinite)).toBe(true);
  });

  it('ticks on hours within a day', () => {
    const s = timeScale({ domain: [jan1, jan1 + day], range: [0, 1] });
    expect(s.ticks().map(s.format)).toEqual(['2026-01-01', '06:00', '12:00', '18:00', '2026-01-02']);
  });
});

describe('ordinalScale', () => {
  it('maps keys to values in turn, wrapping, and takes in new keys', () => {
    const s = ordinalScale({ domain: ['a', 'b', 'c'], range: ['red', 'blue'] });
    expect(['a', 'b', 'c'].map(s.map)).toEqual(['red', 'blue', 'red']);
    expect(s.map('d')).toBe('blue');
    expect(s.ticks()).toEqual(['a', 'b', 'c', 'd']);
    expect(s.format('a')).toBe('a');
  });

  it('throws on an empty range', () => {
    expect(() => ordinalScale({ domain: [], range: [] })).toThrow(/empty range/);
  });
});
