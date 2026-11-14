/**
 * Property tests of color ramps: every sample a `#rrggbb`, both ends exact, a ramp between one color and itself
 * flat, the step count taken whole, and the chroma envelope continuous and finite.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { hexToOklchDeg } from './colorSpaces';
import { colorRamp, rampColor, type ColorRampOptions } from './ramp';
import { chromaAt, type ChromaCurve } from './chromaCurve';
import { hex6, runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 200;
const HEX = /^#[0-9a-f]{6}$/;

const curve: fc.Arbitrary<ChromaCurve> = fc.tuple(
  fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }),
  fc.double({ min: 0, max: 0.4, noNaN: true }), fc.double({ min: 0, max: 0.4, noNaN: true }), fc.double({ min: 0, max: 0.4, noNaN: true }),
).map(([a, b, c, cBot, cPeak, cTop]) => {
  const [lo, mid, hi] = [a, b, c].sort((x, y) => x - y) as [number, number, number];
  return { lRange: [lo, hi], midL: mid, cBot, cPeak, cTop };
});

const options: fc.Arbitrary<ColorRampOptions> = fc.record({
  space: fc.constantFrom('oklch', 'hsl', 'oklab', 'srgb', 'srgb-linear'),
  hue: fc.constantFrom('shorter', 'longer'),
}, { requiredKeys: [] });

describe('colorRamp', () => {
  it('holds floor(steps) samples, each a #rrggbb, its ends the two colors', () => {
    const t = tally();
    const steps = fc.oneof(fc.integer({ min: -2, max: 12 }), fc.double({ min: -2, max: 12, noNaN: true }), fc.constant(Number.NaN));
    fc.assert(fc.property(hex6, hex6, steps, options, (from, to, n, opts) => {
      const ramp = colorRamp(from, to, n, opts);
      const want = Number.isNaN(n) ? 0 : Math.max(0, Math.floor(n));
      expect(ramp).toHaveLength(want);
      for (const c of ramp) expect(c).toMatch(HEX);
      if (want >= 1) expect(ramp[0]).toBe(from);
      if (want >= 2) { expect(ramp.at(-1)).toBe(to); t.count('ends'); }
    }), runs(RUNS));
    t.atLeast('ends', 25);
  }, timeoutFor(RUNS, 3));

  it('is flat between a color and itself', () => {
    fc.assert(fc.property(hex6, fc.double({ min: 0, max: 1, noNaN: true }), options, (c, t, opts) => {
      expect(rampColor(c, c, t, opts)).toBe(c);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 2));

  it('runs backward when its ends swap, in the spaces that cut a straight line, to within a byte', () => {
    const bytes = (h: string) => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16));
    fc.assert(fc.property(hex6, hex6, fc.integer({ min: 0, max: 8 }), fc.constantFrom('oklab', 'srgb', 'srgb-linear'), (a, b, k, space) => {
      const t = k / 8;
      // A channel landing on a half rounds whichever way the float sum falls.
      const there = bytes(rampColor(a, b, t, { space }));
      const back = bytes(rampColor(b, a, 1 - t, { space }));
      there.forEach((v, i) => expect(Math.abs(v - back[i]!)).toBeLessThanOrEqual(1));
    }), runs(RUNS));
  }, timeoutFor(RUNS, 2));

  it('lays each sample under the chroma envelope, where it fits the gamut', () => {
    const t = tally();
    fc.assert(fc.property(hex6, hex6, fc.double({ min: 0, max: 1, noNaN: true }), options, curve, (from, to, at, opts, chroma) => {
      const out = rampColor(from, to, at, { ...opts, chroma });
      expect(out).toMatch(HEX);
      const s = hexToOklchDeg(out);
      expect(Number.isFinite(s.L) && Number.isFinite(s.C)).toBe(true);
      expect(s.C).toBeLessThanOrEqual(Math.max(chroma.cBot, chroma.cPeak, chroma.cTop) + 0.02);
      t.count('sampled');
    }), runs(RUNS));
    t.atLeast('sampled', 50);
  }, timeoutFor(RUNS, 3));
});

describe('chromaAt', () => {
  it('is finite, flat past the range, between its three levels inside it, and continuous at every joint', () => {
    const t = tally();
    fc.assert(fc.property(curve, fc.double({ min: -0.5, max: 1.5, noNaN: true }), (c, L) => {
      const v = chromaAt(L, c);
      expect(Number.isFinite(v)).toBe(true);
      const [lo, hi] = c.lRange;
      if (L <= lo) expect(v).toBe(c.cBot);
      else if (L >= hi) expect(v).toBe(c.cTop);
      else {
        t.count('inside');
        const side = L <= c.midL ? [c.cBot, c.cPeak] : [c.cPeak, c.cTop];
        expect(v).toBeGreaterThanOrEqual(Math.min(...side) - 1e-12);
        expect(v).toBeLessThanOrEqual(Math.max(...side) + 1e-12);
      }
      if (lo < c.midL && c.midL < hi) {
        t.count('joints');
        expect(chromaAt(c.midL, c)).toBeCloseTo(c.cPeak, 12);
      }
    }), runs(RUNS));
    t.atLeast('inside', 50);
    t.atLeast('joints', 50);
  }, timeoutFor(RUNS, 1));
});
