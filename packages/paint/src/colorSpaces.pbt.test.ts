import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  hexToOklchDeg, interpolateSrgb, lerpColorArray, lerpOklch, linearSrgbToOklab, linearToSrgb,
  oklabToLinearSrgb, oklabToOklch, oklabToSrgbU8, oklchDegToHex, oklchToOklab, srgbToLinear,
  srgbU8ToOklab, type ColorInterpolationSpace,
} from './colorSpaces';
import { lerpHueDeg } from './hue';
import { shortArc } from './shortArc';
import { byte, hexColor, hueDeg, maxDiff, rgb, rgba, runs, tally, timeoutFor, unit } from './pbt.fixture';

const RUNS = runs(300);
const SPACES: ColorInterpolationSpace[] = ['srgb', 'srgb-linear', 'oklab', 'oklch', 'hsl'];
const space = fc.constantFrom(...SPACES);

describe('sRGB transfer, property', () => {
  it('linearToSrgb undoes srgbToLinear, either side of zero', () => {
    fc.assert(fc.property(fc.double({ min: -2, max: 2, noNaN: true }), (c) => {
      expect(Math.abs(linearToSrgb(srgbToLinear(c)) - c)).toBeLessThanOrEqual(1e-12 * Math.max(1, Math.abs(c)));
      expect(srgbToLinear(-c) === -srgbToLinear(c)).toBe(true);
    }), RUNS);
  });

  it('is monotone', () => {
    fc.assert(fc.property(fc.double({ min: -2, max: 2, noNaN: true }), fc.double({ min: -2, max: 2, noNaN: true }), (a, b) => {
      const [lo, hi] = a <= b ? [a, b] : [b, a];
      expect(srgbToLinear(lo)).toBeLessThanOrEqual(srgbToLinear(hi));
      expect(linearToSrgb(lo)).toBeLessThanOrEqual(linearToSrgb(hi));
    }), RUNS);
  });
});

describe('OKLab, property', () => {
  it('carries an in-gamut linear color through OKLab and back', () => {
    fc.assert(fc.property(rgb, ([r, g, b]) => {
      const back = oklabToLinearSrgb(...linearSrgbToOklab(r, g, b));
      expect(maxDiff(back, [r, g, b])).toBeLessThan(1e-6);
    }), RUNS);
  });

  it('carries every 8-bit color through OKLab and back to its own bytes', () => {
    fc.assert(fc.property(byte, byte, byte, (r, g, b) => {
      expect(oklabToSrgbU8(...srgbU8ToOklab(r, g, b))).toEqual([r, g, b]);
    }), { numRuns: RUNS.numRuns * 10 });
  }, timeoutFor(300, 0.5));

  it('clips any OKLab color to whole bytes', () => {
    const wide = fc.double({ min: -2, max: 2, noNaN: true });
    fc.assert(fc.property(wide, wide, wide, (L, A, B) => {
      for (const v of oklabToSrgbU8(L, A, B)) {
        expect(Number.isInteger(v)).toBe(true);
        expect(v >= 0 && v <= 255).toBe(true);
      }
    }), RUNS);
  });

  it('turns OKLab into OKLCh and back', () => {
    const ab = fc.double({ min: -0.5, max: 0.5, noNaN: true });
    fc.assert(fc.property(unit, ab, ab, (L, A, B) => {
      const [l, C, h] = oklabToOklch(L, A, B);
      expect(C).toBeGreaterThanOrEqual(0);
      expect(Math.abs(h)).toBeLessThanOrEqual(Math.PI);
      expect(maxDiff(oklchToOklab(l, C, h), [L, A, B])).toBeLessThan(1e-15);
    }), RUNS);
  });

  it('reads back the hex oklchDegToHex writes from hexToOklchDeg', () => {
    fc.assert(fc.property(hexColor, ({ text }) => {
      const { L, C, H } = hexToOklchDeg(text);
      expect(H >= 0 && H < 360).toBe(true);
      expect(oklchDegToHex(L, C, H)).toBe(text.slice(0, 7).toLowerCase());
    }), RUNS);
  });

  it('lerpOklch keeps both ends, and its hue moves by the shorter arc', () => {
    const lch = fc.tuple(unit, fc.double({ min: 0, max: 0.4, noNaN: true }), fc.double({ min: -Math.PI, max: Math.PI, noNaN: true }));
    fc.assert(fc.property(lch, lch, unit, (a, b, t) => {
      const at0 = lerpOklch(a, b, 0);
      const at1 = lerpOklch(a, b, 1);
      expect(at0[0]).toBe(a[0]);
      expect(at0[1]).toBe(a[1]);
      expect(Math.abs(at1[0] - b[0])).toBeLessThan(1e-15);
      expect(Math.abs(at1[1] - b[1])).toBeLessThan(1e-15);
      const mid = lerpOklch(a, b, t);
      const from = a[1] < 1e-4 ? b[2] : a[2];
      expect(Math.abs(shortArc(mid[2] - from))).toBeLessThanOrEqual(Math.PI * t + 1e-12);
    }), RUNS);
  });
});

describe('hue arcs, property', () => {
  it('lerpHueDeg starts and ends at its hues, in [0, 360), along the arc it names', () => {
    const t = tally();
    fc.assert(fc.property(hueDeg, hueDeg, unit, fc.constantFrom('shorter', 'longer') as fc.Arbitrary<'shorter' | 'longer'>, (h1, h2, u, method) => {
      const wrap = (h: number): number => ((h % 360) + 360) % 360;
      const near = (a: number, b: number): number => Math.abs(((a - b + 540) % 360) - 180);
      expect(near(lerpHueDeg(h1, h2, 0, method), wrap(h1))).toBeLessThan(1e-9);
      expect(near(lerpHueDeg(h1, h2, 1, method), wrap(h2))).toBeLessThan(1e-9);
      const mid = lerpHueDeg(h1, h2, u, method);
      expect(mid >= 0 && mid < 360, `${mid}`).toBe(true);
      const d = Math.abs(wrap(h2) - wrap(h1));
      const gap = Math.min(d, 360 - d);
      const arc = method === 'shorter' ? gap : gap === 0 ? 0 : 360 - gap;
      t.count(method);
      expect(near(mid, wrap(h1))).toBeLessThanOrEqual(arc * u + 1e-6);
      expect(near(mid, wrap(h2))).toBeLessThanOrEqual(arc * (1 - u) + 1e-6);
    }), RUNS);
    t.atLeast('shorter', 1);
    t.atLeast('longer', 1);
  });

  it('shortArc lands in [-π, π], a whole number of turns from where it started', () => {
    fc.assert(fc.property(fc.double({ min: -100, max: 100, noNaN: true }), (dh) => {
      const r = shortArc(dh);
      expect(Math.abs(r)).toBeLessThanOrEqual(Math.PI);
      const turns = (dh - r) / (2 * Math.PI);
      expect(Math.abs(turns - Math.round(turns))).toBeLessThan(1e-12);
    }), RUNS);
  });
});

describe('interpolateSrgb, property', () => {
  it('starts at from and ends at to, in every space', () => {
    fc.assert(fc.property(rgb, rgb, space, (a, b, s) => {
      expect(maxDiff(interpolateSrgb(a, b, 0, s), a)).toBeLessThan(1e-5);
      expect(maxDiff(interpolateSrgb(a, b, 1, s), b)).toBeLessThan(1e-5);
    }), RUNS);
  });

  it('holds a color still when both ends are it', () => {
    fc.assert(fc.property(rgb, unit, space, fc.constantFrom('shorter', 'longer') as fc.Arbitrary<'shorter' | 'longer'>, (a, t, s, hue) => {
      expect(maxDiff(interpolateSrgb(a, a, t, s, hue), a)).toBeLessThan(1e-5);
    }), RUNS);
  });

  it('stays in gamut between the ends', () => {
    fc.assert(fc.property(rgb, rgb, unit, space, (a, b, t, s) => {
      const c = interpolateSrgb(a, b, t, s);
      expect(c.every((v) => v >= -1e-9 && v <= 1 + 1e-9), `${s} ${c}`).toBe(true);
    }), RUNS);
  });

  it('is linear per channel in srgb, and monotone per channel in srgb-linear', () => {
    fc.assert(fc.property(rgb, rgb, unit, unit, (a, b, t, u) => {
      const [lo, hi] = t <= u ? [t, u] : [u, t];
      const x = interpolateSrgb(a, b, lo, 'srgb-linear');
      const y = interpolateSrgb(a, b, hi, 'srgb-linear');
      for (let i = 0; i < 3; i++) {
        if (b[i]! >= a[i]!) expect(y[i]! - x[i]!).toBeGreaterThanOrEqual(-1e-12);
        else expect(x[i]! - y[i]!).toBeGreaterThanOrEqual(-1e-12);
        expect(Math.abs(interpolateSrgb(a, b, t, 'srgb')[i]! - (a[i]! + (b[i]! - a[i]!) * t))).toBeLessThan(1e-15);
      }
    }), RUNS);
  });
});

describe('lerpColorArray, property', () => {
  it('answers from at 0 and to at 1, to the byte in the byte-precision spaces', () => {
    const colors = (n: number) => fc.array(rgba, { minLength: n, maxLength: n }).map((cs) => cs.flat());
    const cs = fc.integer({ min: 1, max: 3 }).chain((n) => fc.tuple(colors(n), colors(n)));
    fc.assert(fc.property(cs, fc.constantFrom('rgb', 'oklab', 'oklch') as fc.Arbitrary<'rgb' | 'oklab' | 'oklch'>, ([a, b], s) => {
      const tol = s === 'rgb' ? 0 : 0.5 / 255 + 1e-12;
      expect(maxDiff(lerpColorArray(a, b, 0, s), a)).toBeLessThanOrEqual(tol);
      expect(maxDiff(lerpColorArray(a, b, 1, s), b)).toBeLessThanOrEqual(s === 'rgb' ? 1e-15 : tol);
    }), RUNS);
  });
});
