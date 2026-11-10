import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { interpolateSrgb } from './colorSpaces';
import { hslToSrgb, srgbToHsl } from './hsl';
import { hueDeg, maxDiff, rgb, runs, unit } from './pbt.fixture';

const RUNS = runs(300);
const inRange = (c: readonly number[]): boolean => c.every((v) => v >= 0 && v <= 1);

describe('HSL, property', () => {
  it('srgbToHsl undoes hslToSrgb', () => {
    fc.assert(fc.property(rgb, ([r, g, b]) => {
      const [h, s, l] = srgbToHsl(r, g, b);
      expect(h >= 0 && h < 360).toBe(true);
      expect(s >= 0 && s <= 1, `s ${s}`).toBe(true);
      expect(maxDiff(hslToSrgb(h, s, l), [r, g, b])).toBeLessThan(1e-9);
    }), RUNS);
  });

  it('reads a hue a turn either way as the same hue, and answers channels in 0..1', () => {
    fc.assert(fc.property(hueDeg, unit, unit, fc.integer({ min: -3, max: 3 }), (h, s, l, turns) => {
      const c = hslToSrgb(h, s, l);
      expect(inRange(c), `${h} → ${c}`).toBe(true);
      expect(maxDiff(hslToSrgb(h + 360 * turns, s, l), c)).toBeLessThan(1e-9);
    }), RUNS);
  });

  it('reads a hue outside one turn (shrunk counterexample)', () => {
    expect(hslToSrgb(720, 1, 0.5)).toEqual(hslToSrgb(0, 1, 0.5));
    expect(hslToSrgb(-400, 1, 0.5).every((v) => v >= 0 && v <= 1)).toBe(true);
  });

  it('gives a color an ulp from white or black a finite saturation (shrunk counterexample)', () => {
    expect(srgbToHsl(0, 0, 5e-324).every(Number.isFinite)).toBe(true);
    expect(srgbToHsl(1, 1, 1 - 2 ** -53).every(Number.isFinite)).toBe(true);
    expect(srgbToHsl(0.9999999999999981, 1, 1)[1]).toBeLessThanOrEqual(1);
    expect(interpolateSrgb([0, 0, 0], [0, 0, 5e-324], 0.5, 'hsl').every(Number.isFinite)).toBe(true);
  });
});
