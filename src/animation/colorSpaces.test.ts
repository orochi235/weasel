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
