import { describe, expect, it } from 'vitest';
import { srgbU8ToOklab, oklabToSrgbU8, lerpColorArray } from './colorSpaces';

describe('srgbU8 ↔ Oklab', () => {
  it('round-trips every byte triple within ±1 per channel', () => {
    const samples: Array<[number, number, number]> = [
      [0, 0, 0], [255, 255, 255], [128, 128, 128],
      [255, 0, 0], [0, 255, 0], [0, 0, 255],
      [200, 100, 50], [17, 234, 91], [255, 254, 253],
    ];
    for (const [r, g, b] of samples) {
      const [L, A, B] = srgbU8ToOklab(r, g, b);
      const [r2, g2, b2] = oklabToSrgbU8(L, A, B);
      expect(Math.abs(r2 - r)).toBeLessThanOrEqual(1);
      expect(Math.abs(g2 - g)).toBeLessThanOrEqual(1);
      expect(Math.abs(b2 - b)).toBeLessThanOrEqual(1);
    }
  });
});

describe('lerpColorArray', () => {
  it('rgb midpoint between red and green is muddy gray', () => {
    const mid = lerpColorArray([255, 0, 0, 255], [0, 255, 0, 255], 0.5, 'rgb');
    expect(mid).toEqual([128, 128, 0, 255]);
  });

  it('oklab midpoint between red and green is NOT gray (luminance and chroma preserved)', () => {
    const mid = lerpColorArray([255, 0, 0, 255], [0, 255, 0, 255], 0.5, 'oklab');
    expect(mid[0]).not.toBe(128);
    expect(mid[0]).toBeGreaterThan(100);
    expect(mid[1]).toBeGreaterThan(100);
    expect(mid[2]).toBeLessThan(80);
  });

  it('throws on length mismatch', () => {
    expect(() => lerpColorArray([0, 0, 0, 255], [0, 0, 0, 255, 0, 0, 0, 255], 0.5)).toThrow();
  });

  it('throws on length not divisible by 4', () => {
    expect(() => lerpColorArray([0, 0, 0], [255, 255, 255], 0.5)).toThrow();
  });

  it('alpha lerps linearly even in oklab mode', () => {
    const mid = lerpColorArray([0, 0, 0, 0], [0, 0, 0, 200], 0.5, 'oklab');
    expect(mid[3]).toBe(100);
  });
});

describe('lerpColorArray oklch', () => {
  it('red → green midpoint passes through yellow (not gray)', () => {
    const mid = lerpColorArray([255, 0, 0, 255], [0, 255, 0, 255], 0.5, 'oklch');
    // Both endpoints have high chroma — midpoint should remain chromatic.
    // Yellow-ish: R high, G high, B low.
    expect(mid[0]).toBeGreaterThan(150);
    expect(mid[1]).toBeGreaterThan(120);
    expect(mid[2]).toBeLessThan(80);
    // Sanity: distinct from rgb midpoint [128, 128, 0, 255].
    expect(mid[0]).not.toBe(128);
  });

  it('red → blue takes the short arc through magenta (not green)', () => {
    // Red is hue~30°, blue is hue~265° in OKLab polar terms — short arc is backward through magenta.
    const mid = lerpColorArray([255, 0, 0, 255], [0, 0, 255, 255], 0.5, 'oklch');
    // Magenta-ish: R high-ish, G low, B high-ish (not green-ish: R low, G high, B low).
    expect(mid[0]).toBeGreaterThan(80);
    expect(mid[1]).toBeLessThan(60);
    expect(mid[2]).toBeGreaterThan(80);
  });

  it('hue interpolation goes through black-axis when chroma vanishes', () => {
    // White → black: both endpoints have C=0, so hue is undefined; interpolation
    // should just lerp lightness without spurious hue rotation.
    const mid = lerpColorArray([255, 255, 255, 255], [0, 0, 0, 255], 0.5, 'oklch');
    // Should be a neutral gray.
    expect(Math.abs(mid[0] - mid[1])).toBeLessThanOrEqual(2);
    expect(Math.abs(mid[1] - mid[2])).toBeLessThanOrEqual(2);
  });

  it('throws on length mismatch in oklch mode', () => {
    expect(() => lerpColorArray([0, 0, 0, 255], [0, 0, 0, 255, 0, 0, 0, 255], 0.5, 'oklch')).toThrow();
  });
});
