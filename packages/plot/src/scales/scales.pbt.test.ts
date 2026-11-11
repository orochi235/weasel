/**
 * The scales' laws: ends exact, monotone, inverted back, finite for any finite domain; ticks inside the domain,
 * ordered, evenly stepped, about as many as asked, and labeled apart; nice domains holding the data on whole steps.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { anyFinite, runs, tally, timeoutFor } from '../pbt.fixture';
import { bandScale } from './band';
import { linearScale, niceDomain } from './linear';
import { logScale } from './log';
import { polarScale } from './polar';
import { timeScale } from './time';
import { powScale } from './warp';

const RUNS = 300;

/** A domain end at any scale, from the double range's edge down to the subnormals. */
const end = fc.oneof(
  { weight: 3, arbitrary: fc.integer({ min: -1000, max: 1000 }) },
  { weight: 3, arbitrary: fc.double({ min: -1e6, max: 1e6, noNaN: true }) },
  { weight: 2, arbitrary: anyFinite },
  { weight: 1, arbitrary: fc.constantFrom(-Number.MAX_VALUE, Number.MAX_VALUE, -1e308, 1e308) },
);
const range = fc.tuple(fc.integer({ min: -2000, max: 2000 }), fc.integer({ min: -2000, max: 2000 }));
const count = fc.integer({ min: 1, max: 20 });
const share = fc.oneof(fc.double({ min: 0, max: 1, noNaN: true }), fc.constantFrom(0, 0.5, 1));

/** `t` of the way from `a` to `b`; in halves where the distance is past the double range. */
const lerp = (a: number, b: number, t: number): number => (Number.isFinite(b - a) ? a + t * (b - a) : 2 * (a / 2 + t * (b / 2 - a / 2)));
/** `|b - a|`, halved, so it does not overflow. */
const halfSpan = (a: number, b: number): number => Math.abs(b / 2 - a / 2);

describe('linearScale', () => {
  it('sends the domain\'s ends to the range\'s exactly, stays inside it, and inverts back', () => {
    const seen = tally();
    fc.assert(fc.property(end, end, range, share, (d0, d1, [r0, r1], t) => {
      fc.pre(d0 !== d1);
      const s = linearScale({ domain: [d0, d1], range: [r0, r1] });
      expect(s.map(d0)).toBe(r0);
      expect(s.map(d1)).toBe(r1);
      // Rounding at the double range's end can carry the point past it.
      const v = Math.min(Math.max(d0, d1), Math.max(Math.min(d0, d1), lerp(d0, d1, t)));
      const at = s.map(v);
      expect(at).toBeGreaterThanOrEqual(Math.min(r0, r1) - 1e-9);
      expect(at).toBeLessThanOrEqual(Math.max(r0, r1) + 1e-9);
      if (!Number.isFinite(d1 - d0)) seen.count('wide');
      if (r0 !== r1) {
        seen.count('inverted');
        expect(Math.abs(s.invert(at) - v)).toBeLessThanOrEqual(1e-9 * halfSpan(d0, d1) * 2);
      }
    }), { ...runs(RUNS), examples: [[-Number.MAX_VALUE, Number.MAX_VALUE, [0, 100], 0.5], [1e308, -1e308, [3, -7], 0.25]] });
    seen.atLeast('inverted', RUNS / 2);
    seen.atLeast('wide', 2);
  }, timeoutFor(RUNS, 1));

  it('keeps the order of any two values, either way round, and stays finite past the domain', () => {
    fc.assert(fc.property(end, end, range, anyFinite, anyFinite, (d0, d1, [r0, r1], a, b) => {
      fc.pre(d0 !== d1 && r0 !== r1);
      const s = linearScale({ domain: [d0, d1], range: [r0, r1] });
      const [ma, mb] = [s.map(a), s.map(b)];
      expect(Number.isNaN(ma) || Number.isNaN(mb)).toBe(false);
      const same = (d1 > d0) === (r1 > r0);
      if (a < b) expect(same ? ma <= mb : ma >= mb).toBe(true);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));

  it('ticks inside the domain, ascending its way, on an even 1/2/5 step, about as many as asked, labeled apart', () => {
    const seen = tally();
    fc.assert(fc.property(end, end, count, (d0, d1, n) => {
      fc.pre(d0 !== d1 && Number.isFinite(d1 - d0));
      const s = linearScale({ domain: [d0, d1], range: [0, 1] });
      const ticks = s.ticks(n);
      const step = s.tickStep(n);
      const [lo, hi] = [Math.min(d0, d1), Math.max(d0, d1)];
      for (const t of ticks) {
        expect(t).toBeGreaterThanOrEqual(lo - step * 1e-6);
        expect(t).toBeLessThanOrEqual(hi + step * 1e-6);
      }
      // Countable grids only: one too fine for the domain's magnitude collapses onto a few doubles, and a step under
      // the subnormals cannot be written.
      if (hi - lo > Math.max(Math.abs(lo), Math.abs(hi)) * 1e-6 && hi - lo > 1e-300 && ticks.length > 0) {
        seen.count('counted');
        for (let i = 1; i < ticks.length; i++) {
          const gap = d0 < d1 ? ticks[i]! - ticks[i - 1]! : ticks[i - 1]! - ticks[i]!;
          expect(Math.abs(gap - step)).toBeLessThanOrEqual(step * 1e-6);
        }
        const mantissa = step / 10 ** Math.floor(Math.log10(step));
        expect([1, 2, 5, 10].some((m) => Math.abs(mantissa - m) < 1e-6)).toBe(true);
        expect(ticks.length).toBeGreaterThanOrEqual(Math.max(1, Math.floor(n / 3)));
        expect(ticks.length).toBeLessThanOrEqual(3 * n + 1);
        const write = s.tickFormat(n);
        expect(new Set(ticks.map(write)).size).toBe(ticks.length);
      }
    }), runs(RUNS));
    seen.atLeast('counted', RUNS / 3);
  }, timeoutFor(RUNS, 2));

  it('widens a nice domain to hold the data on whole steps', () => {
    const seen = tally();
    fc.assert(fc.property(end, end, count, (d0, d1, n) => {
      const [a, b] = niceDomain([d0, d1], n);
      expect(Number.isFinite(a) && Number.isFinite(b)).toBe(true);
      expect(a).not.toBe(b);
      if (d0 === d1) return;
      seen.count('spanned');
      const step = Math.abs(b / 2 - a / 2) * 2 * 1e-9;
      expect(Math.sign(b - a)).toBe(Math.sign(d1 - d0));
      // Widened or kept: never cut short by more than the tick grid's tolerance.
      const tol = Math.max(halfSpan(d0, d1), halfSpan(a, b)) * 1e-8 + Math.max(Math.abs(d0), Math.abs(d1)) * 1e-15;
      expect(Math.min(a, b)).toBeLessThanOrEqual(Math.min(d0, d1) + tol + step);
      expect(Math.max(a, b)).toBeGreaterThanOrEqual(Math.max(d0, d1) - tol - step);
    }), runs(RUNS));
    seen.atLeast('spanned', RUNS / 2);
  }, timeoutFor(RUNS, 1));
});

describe('logScale', () => {
  const positive = fc.oneof(fc.double({ min: 1e-12, max: 1e12, noNaN: true }), fc.constantFrom(5e-324, Number.MAX_VALUE, 1, 10, 100));
  const base = fc.oneof(fc.constant(10), fc.constantFrom(2, Math.E, 0.5), fc.double({ min: 1.1, max: 100, noNaN: true }));

  it('sends the ends exactly, inverts back, and ticks inside the domain in order, labeled apart', () => {
    const seen = tally();
    fc.assert(fc.property(positive, positive, range, base, share, (d0, d1, [r0, r1], b, t) => {
      fc.pre(d0 !== d1);
      const s = logScale({ domain: [d0, d1], range: [r0, r1], base: b });
      expect(s.map(d0)).toBe(r0);
      expect(s.map(d1)).toBe(r1);
      const v = d0 ** (1 - t) * d1 ** t;
      fc.pre(Number.isFinite(v) && v > 0);
      if (r0 !== r1) {
        seen.count('inverted');
        expect(Math.abs(s.invert(s.map(v)) / v - 1)).toBeLessThanOrEqual(1e-6);
      }
      const ticks = s.ticks(5);
      const [lo, hi] = [Math.min(d0, d1), Math.max(d0, d1)];
      for (const tick of ticks) {
        expect(tick).toBeGreaterThanOrEqual(lo * (1 - 1e-9));
        expect(tick).toBeLessThanOrEqual(hi * (1 + 1e-9));
      }
      for (let i = 1; i < ticks.length; i++) expect(d0 < d1 ? ticks[i]! > ticks[i - 1]! : ticks[i]! < ticks[i - 1]!).toBe(true);
      if (ticks.length > 1) seen.count('ticked');
      expect(ticks.length).toBeLessThanOrEqual(2 * 5 + 1 + 3 * 5);
      const write = s.tickFormat();
      expect(new Set(ticks.map(write)).size).toBe(ticks.length);
    }), runs(RUNS));
    seen.atLeast('inverted', RUNS / 3);
    seen.atLeast('ticked', RUNS / 10);
  }, timeoutFor(RUNS, 2));
});

describe('powScale', () => {
  it('sends the ends exactly and inverts back', () => {
    const exponent = fc.oneof(fc.constantFrom(0.5, 2, 3, 1 / 3), fc.double({ min: 0.1, max: 4, noNaN: true }));
    fc.assert(fc.property(fc.integer({ min: -1000, max: 1000 }), fc.integer({ min: -1000, max: 1000 }), range, exponent, share, (d0, d1, [r0, r1], k, t) => {
      fc.pre(d0 !== d1 && r0 !== r1);
      const s = powScale({ domain: [d0, d1], range: [r0, r1], exponent: k });
      expect(s.map(d0)).toBeCloseTo(r0, 9);
      expect(s.map(d1)).toBeCloseTo(r1, 9);
      const v = d0 + t * (d1 - d0);
      expect(Math.abs(s.invert(s.map(v)) - v)).toBeLessThanOrEqual(1e-6 * Math.max(1, Math.abs(d1 - d0)));
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});

describe('timeScale', () => {
  const instant = fc.oneof(
    fc.integer({ min: -8.64e15, max: 8.64e15 }),
    fc.integer({ min: Date.UTC(2020, 0, 1), max: Date.UTC(2030, 0, 1) }),
  );
  const span = fc.oneof(fc.integer({ min: 1, max: 1000 }), fc.integer({ min: 1000, max: 1e9 }), fc.integer({ min: 1e9, max: 1e14 }));

  it('ticks on its grid inside the domain in order, a neighbor never labeled as the one before', () => {
    const seen = tally();
    fc.assert(fc.property(instant, span, fc.boolean(), count, (at, length, backward, n) => {
      const [d0, d1] = backward ? [at + length, at] : [at, at + length];
      const s = timeScale({ domain: [d0, d1], range: [0, 800] });
      const ticks = s.ticks(n);
      for (const t of ticks) {
        expect(t).toBeGreaterThanOrEqual(Math.min(d0, d1));
        expect(t).toBeLessThanOrEqual(Math.max(d0, d1));
      }
      for (let i = 1; i < ticks.length; i++) expect(backward ? ticks[i]! < ticks[i - 1]! : ticks[i]! > ticks[i - 1]!).toBe(true);
      expect(ticks.length).toBeLessThanOrEqual(Math.max(60, 12 * n));
      if (ticks.length > 1) seen.count('ticked');
      const write = s.tickFormat(n);
      for (let i = 1; i < ticks.length; i++) expect(write(ticks[i]!)).not.toBe(write(ticks[i - 1]!));
      expect(s.map(d0)).toBe(0);
      expect(s.map(d1)).toBe(800);
    }), runs(RUNS));
    seen.atLeast('ticked', RUNS / 3);
  }, timeoutFor(RUNS, 3));
});

describe('bandScale', () => {
  const pad = fc.oneof(fc.constantFrom(0, 0.2, 1), fc.double({ min: -1, max: 2, noNaN: true }));
  it('lays bands in order within the range, each found again by its center', () => {
    const seen = tally();
    fc.assert(fc.property(fc.uniqueArray(fc.string({ maxLength: 3 }), { maxLength: 12 }), range, pad, fc.option(pad, { nil: undefined }), (keys, [r0, r1], inner, outer) => {
      const s = bandScale({ domain: keys, range: [r0, r1], paddingInner: inner, ...(outer !== undefined ? { paddingOuter: outer } : {}) });
      expect(s.bandwidth).toBeGreaterThanOrEqual(0);
      expect(s.bandwidth).toBeLessThanOrEqual(Math.abs(r1 - r0) + 1e-9);
      const [lo, hi] = [Math.min(r0, r1), Math.max(r0, r1)];
      keys.forEach((k, i) => {
        const start = s.start(k);
        expect(start).toBeGreaterThanOrEqual(lo - 1e-6);
        expect(start + s.bandwidth).toBeLessThanOrEqual(hi + 1e-6);
        if (i > 0) expect(r1 >= r0 ? start >= s.start(keys[i - 1]!) : start <= s.start(keys[i - 1]!)).toBe(true);
        if (s.step > 1e-6) {
          seen.count('found');
          expect(s.invert(s.position(k))).toBe(k);
        }
      });
      expect(s.invert(r0)).toBe(keys[0]);
      expect(Number.isNaN(s.start('\u0000not a key'))).toBe(!keys.includes('\u0000not a key'));
    }), runs(RUNS));
    seen.atLeast('found', RUNS);
  }, timeoutFor(RUNS, 1));
});

describe('polarScale', () => {
  it('reads a value back from where it sits on its spoke', () => {
    fc.assert(fc.property(
      fc.integer({ min: -1000, max: 1000 }), fc.integer({ min: -1000, max: 1000 }), fc.integer({ min: 1, max: 12 }), fc.nat(11),
      fc.integer({ min: 1, max: 500 }), share, fc.double({ min: -7, max: 7, noNaN: true }),
      (d0, d1, axes, spoke, outer, t, start) => {
        fc.pre(d0 !== d1);
        const s = polarScale({ center: { x: 100, y: 50 }, radius: [0, outer], domain: [d0, d1], axes, startAngle: start });
        const v = d0 + t * (d1 - d0);
        const i = spoke % axes;
        expect(s.valueAt(i, s.point(i, v))).toBeCloseTo(v, 6);
        expect(s.valueAt(i, s.point(i, v), true)).toBeCloseTo(v, 6);
        const r = Math.hypot(s.point(i, v).x - 100, s.point(i, v).y - 50);
        expect(r).toBeCloseTo(s.radiusAt(v), 6);
      },
    ), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});
