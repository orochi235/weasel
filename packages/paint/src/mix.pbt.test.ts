import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { ColorInterpolationSpace } from './colorSpaces';
import { mixRgba, mixRgbaWeighted } from './mix';
import { maxDiff, rgba, runs, unit } from './pbt.fixture';

const RUNS = runs(300);
const space = fc.constantFrom<ColorInterpolationSpace>('srgb', 'srgb-linear', 'oklab', 'oklch', 'hsl');
/** Spaces where a mix is a convex combination of the two colors, so it can't depend on which is named first. */
const linear = fc.constantFrom<ColorInterpolationSpace>('srgb', 'srgb-linear', 'oklab');
const visible = fc.tuple(unit, unit, unit, fc.double({ min: 0.01, max: 1, noNaN: true }));
const weight = fc.double({ min: 0.01, max: 10, noNaN: true });
/** What a color draws: its channels premultiplied, so every fully transparent color is one. */
const premul = (c: readonly number[]): number[] => [c[0]! * c[3]!, c[1]! * c[3]!, c[2]! * c[3]!, c[3]!];

describe('mixRgba, property', () => {
  it('is all a at p = 1 and all b at p = 0', () => {
    fc.assert(fc.property(visible, visible, space, (a, b, s) => {
      expect(maxDiff(mixRgba(a, b, 1, s), a)).toBeLessThan(1e-5);
      expect(maxDiff(mixRgba(a, b, 0, s), b)).toBeLessThan(1e-5);
    }), RUNS);
  });

  it('mixes alpha linearly, and answers channels in 0..1', () => {
    fc.assert(fc.property(rgba, rgba, unit, space, (a, b, p, s) => {
      const m = mixRgba(a, b, p, s);
      expect(Math.abs(m[3] - (a[3] * p + b[3] * (1 - p)))).toBeLessThan(1e-15);
      expect(m.every((v) => v >= -1e-9 && v <= 1 + 1e-9), `${m}`).toBe(true);
    }), RUNS);
  });

  it('reads the same whichever color is named first', () => {
    fc.assert(fc.property(rgba, rgba, unit, linear, (a, b, p, s) => {
      expect(maxDiff(premul(mixRgba(a, b, p, s)), premul(mixRgba(b, a, 1 - p, s)))).toBeLessThan(1e-6);
    }), RUNS);
  });

  it('takes none of a transparent side\'s color, in a space with no hue to carry', () => {
    fc.assert(fc.property(visible, rgba, fc.double({ min: 0.01, max: 1, noNaN: true }), linear, (a, b, p, s) => {
      const clear: [number, number, number, number] = [b[0], b[1], b[2], 0];
      const m = mixRgba(a, clear, p, s);
      expect(maxDiff(m.slice(0, 3), a.slice(0, 3))).toBeLessThan(1e-5);
    }), RUNS);
  });

  it('holds a color still when mixed with itself', () => {
    fc.assert(fc.property(visible, unit, space, (a, p, s) => {
      expect(maxDiff(mixRgba(a, a, p, s), a)).toBeLessThan(1e-5);
    }), RUNS);
  });
});

describe('mixRgbaWeighted, property', () => {
  const member = fc.record({ color: rgba, weight });

  it('mixes two members as mixRgba does at the first one\'s share', () => {
    fc.assert(fc.property(member, member, space, (m, n, s) => {
      const want = mixRgba(n.color, m.color, n.weight / (m.weight + n.weight), s);
      expect(maxDiff(mixRgbaWeighted([m, n], s), want)).toBeLessThan(1e-12);
    }), RUNS);
  });

  it('ignores a member weighing nothing, wherever it sits', () => {
    fc.assert(fc.property(fc.array(member, { minLength: 1, maxLength: 4 }), rgba, fc.nat(4), linear, (ms, c, at, s) => {
      const i = at % (ms.length + 1);
      const withZero = [...ms.slice(0, i), { color: c, weight: 0 }, ...ms.slice(i)];
      expect(maxDiff(premul(mixRgbaWeighted(withZero, s)), premul(mixRgbaWeighted(ms, s)))).toBeLessThan(1e-5);
    }), RUNS);
  });

  it('reads the same in any order where the space is linear in sRGB', () => {
    const lin = fc.constantFrom<ColorInterpolationSpace>('srgb', 'srgb-linear');
    fc.assert(fc.property(fc.array(member, { minLength: 2, maxLength: 5 }), lin, (ms, s) => {
      const reversed = [...ms].reverse();
      expect(maxDiff(premul(mixRgbaWeighted(ms, s)), premul(mixRgbaWeighted(reversed, s)))).toBeLessThan(1e-9);
    }), RUNS);
  });
});
