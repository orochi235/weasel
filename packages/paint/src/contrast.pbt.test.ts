import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { rgbaToHex } from './color';
import { contrastLineColor, contrastRatio, luminanceContrast, relativeLuminance, wcagLevels } from './contrast';
import { srgbU8ToOklab } from './colorSpaces';
import { parseHexBytes } from './hex';
import { hexColor, rgb, runs, unit } from './pbt.fixture';

const RUNS = runs(300);
const opaque = rgb.map((c) => rgbaToHex(c));

describe('contrastRatio, property', () => {
  it('is symmetric for opaque colors, 1 between equals, and in [1, 21]', () => {
    fc.assert(fc.property(opaque, opaque, (a, b) => {
      const ab = contrastRatio(a, b)!;
      expect(ab).toBeGreaterThanOrEqual(1);
      expect(ab).toBeLessThanOrEqual(21);
      expect(Math.abs(ab - contrastRatio(b, a)!)).toBeLessThan(1e-12);
      expect(contrastRatio(a, a)).toBe(1);
    }), RUNS);
  });

  it('rates black on white highest: no pair beats it', () => {
    const top = contrastRatio('#000', '#fff')!;
    expect(Math.abs(top - 21)).toBeLessThan(1e-9);
    fc.assert(fc.property(opaque, opaque, (a, b) => {
      expect(contrastRatio(a, b)!).toBeLessThanOrEqual(top);
      expect(Math.max(contrastRatio(a, '#000')!, contrastRatio(a, '#fff')!)).toBeGreaterThanOrEqual(Math.sqrt(21) - 1e-9);
    }), RUNS);
  });

  it('lays a translucent foreground over the background: transparent reads as the background itself', () => {
    fc.assert(fc.property(opaque, hexColor, (bg, fg) => {
      const clear = `${fg.text.slice(0, 7)}00`;
      expect(contrastRatio(clear, bg)).toBe(1);
      const r = contrastRatio(fg.text, bg)!;
      expect(r >= 1 && r <= 21).toBe(true);
    }), RUNS);
  });

  it('agrees with luminanceContrast, which orders its arguments itself', () => {
    fc.assert(fc.property(rgb, rgb, (a, b) => {
      const la = relativeLuminance(...a);
      const lb = relativeLuminance(...b);
      expect(la >= -1e-15 && la <= 1 + 1e-15).toBe(true);
      expect(luminanceContrast(la, lb)).toBe(luminanceContrast(lb, la));
    }), RUNS);
  });

  it('passes AAA only where it passes AA, and large text only more easily', () => {
    fc.assert(fc.property(fc.double({ min: 1, max: 21, noNaN: true }), (ratio) => {
      const small = wcagLevels(ratio, false);
      const large = wcagLevels(ratio, true);
      if (small.aaa) expect(small.aa).toBe(true);
      if (large.aaa) expect(large.aa).toBe(true);
      if (small.aa) expect(large.aa).toBe(true);
      if (small.aaa) expect(large.aaa).toBe(true);
    }), RUNS);
  });
});

describe('contrastLineColor, property', () => {
  it('moves lightness away from the nearer end by at most strength, and writes #rrggbb', () => {
    fc.assert(fc.property(hexColor, unit, ({ text }, strength) => {
      const line = contrastLineColor(text, strength);
      expect(line).toMatch(/^#[0-9a-f]{6}$/);
      const [L] = srgbU8ToOklab(...(parseHexBytes(text)!.slice(0, 3) as [number, number, number]));
      const [M] = srgbU8ToOklab(...(parseHexBytes(line)!.slice(0, 3) as [number, number, number]));
      // Toward the far end, or nowhere: bytes round the step, so allow a byte's worth of lightness.
      if (L > 0.5) expect(M).toBeLessThanOrEqual(L + 0.01);
      else expect(M).toBeGreaterThanOrEqual(L - 0.01);
      expect(Math.abs(M - L)).toBeLessThanOrEqual(strength + 0.01);
    }), RUNS);
  });
});
