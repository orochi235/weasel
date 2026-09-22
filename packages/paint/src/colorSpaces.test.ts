import { describe, expect, it } from 'vitest';
import { srgbU8ToOklab, oklabToSrgbU8, lerpColorArray, mixOklab } from './colorSpaces';

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

// lerpColorArray operates on 0..1 float RGBA — same color space the
// renderer's stroke.vertexColors / fill.vertexColors fields expect. The
// OKLab/OKLCh paths bounce through u8 internally for the gamma-LUT, but
// inputs and outputs stay in float space throughout.

describe('lerpColorArray', () => {
  it('rgb midpoint between red and green is muddy gray (no rounding)', () => {
    const mid = lerpColorArray([1, 0, 0, 1], [0, 1, 0, 1], 0.5, 'rgb');
    expect(mid).toEqual([0.5, 0.5, 0, 1]);
  });

  it('oklab midpoint between red and green is NOT gray (chroma preserved)', () => {
    const mid = lerpColorArray([1, 0, 0, 1], [0, 1, 0, 1], 0.5, 'oklab');
    // Float midpoint comparable to byte > 100 → float > 100/255 ≈ 0.39.
    expect(mid[0]).toBeGreaterThan(0.39);
    expect(mid[1]).toBeGreaterThan(0.39);
    expect(mid[2]).toBeLessThan(80 / 255);
  });

  it('throws on length mismatch', () => {
    expect(() => lerpColorArray([0, 0, 0, 1], [0, 0, 0, 1, 0, 0, 0, 1], 0.5)).toThrow();
  });

  it('throws on length not divisible by 4', () => {
    expect(() => lerpColorArray([0, 0, 0], [1, 1, 1], 0.5)).toThrow();
  });

  it('alpha lerps linearly even in oklab mode', () => {
    const mid = lerpColorArray([0, 0, 0, 0], [0, 0, 0, 0.8], 0.5, 'oklab');
    expect(mid[3]).toBeCloseTo(0.4, 5);
  });
});

describe('lerpColorArray oklch', () => {
  it('red → green midpoint passes through yellow (not gray)', () => {
    const mid = lerpColorArray([1, 0, 0, 1], [0, 1, 0, 1], 0.5, 'oklch');
    // Yellow-ish: R high, G high, B low. Float thresholds parallel to the
    // u8 (>150 / >120 / <80) tests, scaled to 0..1.
    expect(mid[0]).toBeGreaterThan(150 / 255);
    expect(mid[1]).toBeGreaterThan(120 / 255);
    expect(mid[2]).toBeLessThan(80 / 255);
    // Sanity: distinct from rgb midpoint [0.5, 0.5, 0, 1].
    expect(mid[0]).not.toBe(0.5);
  });

  it('red → blue takes the short arc through magenta (not green)', () => {
    const mid = lerpColorArray([1, 0, 0, 1], [0, 0, 1, 1], 0.5, 'oklch');
    // Magenta-ish: R high-ish, G low, B high-ish.
    expect(mid[0]).toBeGreaterThan(80 / 255);
    expect(mid[1]).toBeLessThan(60 / 255);
    expect(mid[2]).toBeGreaterThan(80 / 255);
  });

  it('hue interpolation goes through black-axis when chroma vanishes', () => {
    const mid = lerpColorArray([1, 1, 1, 1], [0, 0, 0, 1], 0.5, 'oklch');
    expect(Math.abs(mid[0] - mid[1])).toBeLessThanOrEqual(2 / 255);
    expect(Math.abs(mid[1] - mid[2])).toBeLessThanOrEqual(2 / 255);
  });

  it('throws on length mismatch in oklch mode', () => {
    expect(() => lerpColorArray([0, 0, 0, 1], [0, 0, 0, 1, 0, 0, 0, 1], 0.5, 'oklch')).toThrow();
  });
});

describe('mixOklab', () => {
  const hex = (h: string, a = 1): [number, number, number, number] => {
    const n = Number.parseInt(h.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a];
  };
  const u8 = (c: readonly number[]) => [...c.slice(0, 3).map((v) => Math.round(v * 255)), c[3]];

  // Chrome's own color-mix(in oklab, …), read back through a canvas.
  it.each([
    ['#36bff2', '#ffffff', 0.45, [178, 227, 250]],
    ['#d94a3f', '#25272c', 0.14, [61, 46, 48]],
    ['#ff0000', '#0000ff', 0.5, [140, 83, 162]],
  ] as const)('mixes %s into %s as CSS does', (a, b, p, want) => {
    const got = u8(mixOklab(hex(a), hex(b), p));
    got.slice(0, 3).forEach((v, i) => expect(Math.abs(v - want[i])).toBeLessThanOrEqual(1));
    expect(got[3]).toBe(1);
  });

  it('takes its color from the opaque side of a transparent one, and its opacity from the mix', () => {
    const got = u8(mixOklab(hex('#2e1f7a'), [0, 0, 0, 0], 0.3));
    [46, 30, 123].forEach((v, i) => expect(Math.abs(got[i] - v)).toBeLessThanOrEqual(1));
    expect(got[3]).toBeCloseTo(0.3);
  });
});
