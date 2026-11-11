/**
 * Metamorphic rules over the scales: a domain and range both turned round map alike, a domain turned round ticks the
 * same values the other way, and a replaced `format` labels through `tickFormat`. Then `spacedTicks`, the tick label
 * helpers, and the ordinal and band scales' edges: duplicate keys, empty and degenerate ranges, padding at its ends.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { anyFinite, anyNumber, runs, tally, timeoutFor } from '../pbt.fixture';
import { bandScale } from './band';
import { formatNumber, linearScale } from './linear';
import { logScale } from './log';
import { ordinalScale } from './ordinal';
import { timeScale } from './time';
import { formatTick, tickDecimals, toFixedPlain } from './tickFormat';
import { powScale } from './warp';

const RUNS = 300;

const end = fc.oneof(
  { weight: 3, arbitrary: fc.integer({ min: -1000, max: 1000 }) },
  { weight: 3, arbitrary: fc.double({ min: -1e6, max: 1e6, noNaN: true }) },
  { weight: 2, arbitrary: anyFinite },
);
const range = fc.tuple(fc.integer({ min: -2000, max: 2000 }), fc.integer({ min: -2000, max: 2000 }));
const count = fc.integer({ min: 1, max: 20 });
const positive = fc.oneof(fc.double({ min: 1e-6, max: 1e9, noNaN: true }), fc.constantFrom(1, 10, 100, 5e-324, 1e-300, 1e308));
/** Within `tol` of each other, relative to the larger. */
const near = (a: number, b: number, tol = 1e-9): boolean => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

describe('a scale turned round', () => {
  it('maps a value alike with its domain and range both reversed, and ticks the same values backward', () => {
    const seen = tally();
    fc.assert(fc.property(end, end, range, anyFinite, count, (d0, d1, [r0, r1], v, n) => {
      fc.pre(d0 !== d1 && Number.isFinite(d1 - d0));
      const a = linearScale({ domain: [d0, d1], range: [r0, r1] });
      const b = linearScale({ domain: [d1, d0], range: [r1, r0] });
      if (Math.abs(v) <= Math.max(Math.abs(d0), Math.abs(d1))) expect(near(a.map(v), b.map(v), 1e-6)).toBe(true);
      expect(b.ticks(n)).toEqual([...a.ticks(n)].reverse());
      seen.count('linear');
    }), runs(RUNS));
    fc.assert(fc.property(positive, positive, range, count, (d0, d1, [r0, r1], n) => {
      fc.pre(d0 !== d1);
      const a = logScale({ domain: [d0, d1], range: [r0, r1] });
      const b = logScale({ domain: [d1, d0], range: [r1, r0] });
      const mid = Math.sqrt(d0) * Math.sqrt(d1);
      expect(near(a.map(mid), b.map(mid), 1e-6)).toBe(true);
      expect(b.ticks(n)).toEqual([...a.ticks(n)].reverse());
      seen.count('log');
    }), runs(RUNS));
    const instant = fc.integer({ min: -8.64e15, max: 8.64e15 });
    fc.assert(fc.property(instant, instant, range, count, (d0, d1, [r0, r1], n) => {
      fc.pre(d0 !== d1);
      const a = timeScale({ domain: [d0, d1], range: [r0, r1] });
      const b = timeScale({ domain: [d1, d0], range: [r1, r0] });
      expect(b.ticks(n)).toEqual([...a.ticks(n)].reverse());
      seen.count('time');
    }), runs(RUNS));
    seen.atLeast('linear', RUNS / 2);
    seen.atLeast('log', RUNS / 2);
  }, timeoutFor(RUNS, 6));

  it('labels through a replaced format, whatever the count', () => {
    fc.assert(fc.property(count, anyFinite, (n, v) => {
      const own = (x: number) => `<${x}>`;
      for (const s of [
        linearScale({ domain: [0, 10], range: [0, 1] }), logScale({ domain: [1, 1000], range: [0, 1] }),
        powScale({ domain: [0, 9], range: [0, 1], exponent: 0.5 }), timeScale({ domain: [0, 1e10], range: [0, 1] }),
      ]) {
        expect({ ...s, format: own }.tickFormat(n)(v)).toBe(own(v));
      }
    }), runs(100));
  });
});

describe('linearScale.spacedTicks', () => {
  it('lays ticks ascending inside the inset domain, on one even step, at least the spacing apart, labeled apart', () => {
    const seen = tally();
    fc.assert(fc.property(end, end, range, fc.double({ min: 1, max: 400, noNaN: true }), fc.integer({ min: 0, max: 60 }),
      (d0, d1, [r0, r1], minSpacing, inset) => {
        fc.pre(d0 !== d1 && Number.isFinite(d1 - d0) && r0 !== r1);
        const s = linearScale({ domain: [d0, d1], range: [r0, r1] });
        const { values, step, decimals } = s.spacedTicks({ minSpacing, inset });
        const lo = Math.min(d0, d1);
        const hi = Math.max(d0, d1);
        const perUnit = (hi - lo) / Math.abs(r1 - r0);
        for (const v of values) {
          expect(v).toBeGreaterThanOrEqual(lo + inset * perUnit - 1e-9 * Math.max(1, Math.abs(v)));
          expect(v).toBeLessThanOrEqual(hi - inset * perUnit + 1e-9 * Math.max(1, Math.abs(v)));
        }
        values.slice(1).forEach((v, i) => {
          expect(v).toBeGreaterThan(values[i]!);
          expect(Math.abs(s.map(v) - s.map(values[i]!))).toBeGreaterThanOrEqual(minSpacing * (1 - 1e-6));
        });
        const labels = values.map((v) => formatTick(v, { decimals, step }));
        expect(new Set(labels).size).toBe(labels.length);
        if (values.length > 1) seen.count('several');
      }), runs(RUNS));
    seen.atLeast('several', RUNS / 4);
  }, timeoutFor(RUNS, 2));
});

describe('tick labels', () => {
  it('writes a value to its places without an exponent or a negative zero, and reads back to them', () => {
    fc.assert(fc.property(anyFinite, fc.oneof(fc.integer({ min: 0, max: 20 }), fc.integer({ min: -5, max: 130 })), (v, d) => {
      const text = toFixedPlain(v, d);
      expect(text).not.toMatch(/e/i);
      const places = Math.min(100, Math.max(0, d));
      const after = text.split('.')[1] ?? '';
      expect(after.length).toBe(places);
      expect(Number(text)).toBe(Math.abs(v) >= 1e21 ? v : Number(v.toFixed(places)));
      expect(formatTick(v, { decimals: d, step: 0 })).not.toMatch(/^-0(\.0*)?$/);
    }), runs(RUNS));
  });

  it('counts the places a column needs, so every value written to them reads back', () => {
    fc.assert(fc.property(fc.array(fc.oneof(fc.integer({ min: -1e6, max: 1e6 }).map((k) => k / 1000), anyNumber), { maxLength: 6 }), (values) => {
      const d = tickDecimals(values);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(20);
      for (const v of values.filter((x) => Number.isFinite(x) && Math.abs(x) < 1e15 && Math.abs(x) > 1e-6)) {
        expect(near(Number(toFixedPlain(v, d)), v)).toBe(true);
      }
    }), runs(RUNS));
  });

  it('reads a value on a tick grid back from its label', () => {
    fc.assert(fc.property(fc.integer({ min: -1e6, max: 1e6 }), fc.integer({ min: -12, max: 12 }), fc.constantFrom(1, 2, 5), (i, p, m) => {
      const step = m * 10 ** p;
      const v = Number((i * step).toPrecision(15));
      expect(near(Number(formatNumber(v, step)), v, 1e-12)).toBe(true);
    }), runs(RUNS));
  });
});

describe('ordinalScale', () => {
  const key = fc.constantFrom('a', 'b', 'c', 'd', '', '__proto__', 'constructor');
  it('gives each key one value for good, in domain order, wrapping the range, new keys joining after', () => {
    fc.assert(fc.property(fc.array(key, { maxLength: 6 }), fc.array(fc.integer(), { minLength: 1, maxLength: 4 }), fc.array(key, { maxLength: 10 }),
      (domain, range, asks) => {
        const s = ordinalScale({ domain, range });
        const firsts = new Map<string, number>();
        for (const k of asks) {
          const v = s.map(k);
          if (firsts.has(k)) expect(v).toBe(firsts.get(k));
          firsts.set(k, v);
        }
        const keys = s.ticks();
        expect(new Set(keys).size).toBe(keys.length);
        keys.forEach((k, i) => expect(s.map(k)).toBe(range[i % range.length]));
        expect(keys.slice(0, new Set(domain).size)).toEqual([...new Set(domain)]);
      }), runs(RUNS));
  });
});

describe('bandScale', () => {
  const pad = fc.oneof(fc.double({ min: 0, max: 1, noNaN: true }), fc.constantFrom(0, 1), anyNumber);
  it('lays one band per distinct key inside the range, apart, mirrored when the range turns round', () => {
    const seen = tally();
    fc.assert(fc.property(fc.uniqueArray(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f'), { maxLength: 6 }), range,
      fc.option(pad, { nil: undefined }), fc.option(pad, { nil: undefined }), (domain, [r0, r1], paddingInner, paddingOuter) => {
        const s = bandScale({ domain, range: [r0, r1], paddingInner, paddingOuter });
        const t = bandScale({ domain, range: [r1, r0], paddingInner, paddingOuter });
        const lo = Math.min(r0, r1);
        const hi = Math.max(r0, r1);
        expect(Number.isFinite(s.bandwidth) && Number.isFinite(s.step)).toBe(true);
        const starts = domain.map((k) => s.start(k));
        for (const [i, k] of domain.entries()) {
          expect(Number.isFinite(starts[i]!)).toBe(true);
          expect(starts[i]!).toBeGreaterThanOrEqual(lo - 1e-6);
          expect(starts[i]! + s.bandwidth).toBeLessThanOrEqual(hi + 1e-6);
          expect(near(t.position(k), r0 + r1 - s.position(k), 1e-9)).toBe(true);
        }
        const sorted = [...starts].sort((a, b) => a - b);
        sorted.slice(1).forEach((v, i) => expect(v - sorted[i]!).toBeGreaterThanOrEqual(s.bandwidth - 1e-6));
        if (domain.length > 1 && r0 !== r1) seen.count('several');
      }), runs(RUNS));
    seen.atLeast('several', RUNS / 4);
  }, timeoutFor(RUNS, 1));
});
