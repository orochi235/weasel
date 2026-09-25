import { describe, expect, it } from 'vitest';
import {
  hslToSrgb,
  interpolateSrgb,
  linearSrgbToOklab,
  linearToSrgb,
  oklabToLinearSrgb,
  srgbToHsl,
  srgbToLinear,
  type ColorInterpolationSpace,
} from './colorSpaces';

type Rgb = [number, number, number];

const SAMPLES: Rgb[] = [
  [0.000, 0.000, 0.000],
  [1.000, 1.000, 1.000],
  [0.500, 0.500, 0.500],
  [1.000, 0.000, 0.000],
  [0.000, 1.000, 0.000],
  [0.000, 0.000, 1.000],
  [0.784, 0.392, 0.196],
  [0.067, 0.918, 0.357],
  [0.020, 0.010, 0.003],
];

const expectRgbClose = (got: readonly number[], want: readonly number[], digits = 9) => {
  for (let i = 0; i < 3; i++) expect(got[i]).toBeCloseTo(want[i], digits);
};

describe('round-trips', () => {
  it('sRGB ↔ linear', () => {
    for (const c of SAMPLES) {
      expectRgbClose(c.map((v) => linearToSrgb(srgbToLinear(v))), c, 12);
    }
  });

  it('linear sRGB ↔ OKLab', () => {
    for (const c of SAMPLES) {
      const lin = c.map(srgbToLinear) as Rgb;
      expectRgbClose(oklabToLinearSrgb(...linearSrgbToOklab(...lin)), lin, 6);
    }
  });

  it('sRGB ↔ HSL', () => {
    for (const c of SAMPLES) {
      const [h, s, l] = srgbToHsl(...c);
      expectRgbClose(hslToSrgb(h, s, l), c, 12);
    }
  });

  it('HSL of the primaries', () => {
    expect(srgbToHsl(1, 0, 0)).toEqual([  0, 1, 0.5]);
    expect(srgbToHsl(0, 1, 0)).toEqual([120, 1, 0.5]);
    expect(srgbToHsl(0, 0, 1)).toEqual([240, 1, 0.5]);
    expect(srgbToHsl(0.5, 0.5, 0.5)).toEqual([0, 0, 0.5]);
  });
});

describe('interpolateSrgb', () => {
  const SPACES: ColorInterpolationSpace[] = ['oklch', 'oklab', 'hsl', 'srgb', 'srgb-linear'];
  const red: Rgb = [1, 0, 0];
  const blue: Rgb = [0, 0, 1];

  it('returns each endpoint at t = 0 and t = 1 in every space', () => {
    for (const space of SPACES) {
      expectRgbClose(interpolateSrgb(red, blue, 0, space), red, 5);
      expectRgbClose(interpolateSrgb(red, blue, 1, space), blue, 5);
    }
  });

  // Red → blue at t = 0.5. sRGB and linear agree on hue and differ on
  // lightness; HSL keeps full saturation around the wheel.
  it.each<[ColorInterpolationSpace, Rgb]>([
    ['srgb',        [0.500, 0.000, 0.500]],
    ['srgb-linear', [0.735, 0.000, 0.735]],
    ['hsl',         [1.000, 0.000, 1.000]],
  ])('%s midpoint', (space, want) => {
    expectRgbClose(interpolateSrgb(red, blue, 0.5, space), want, 3);
  });

  it('oklab midpoint is the mean of the OKLab endpoints', () => {
    const mid = interpolateSrgb(red, blue, 0.5, 'oklab');
    const lab = (c: Rgb) => linearSrgbToOklab(...(c.map(srgbToLinear) as Rgb));
    const [La, aa, ba] = lab(red);
    const [Lb, ab, bb] = lab(blue);
    expectRgbClose(lab(mid), [(La + Lb) / 2, (aa + ab) / 2, (ba + bb) / 2], 6);
  });

  it('oklch midpoint sits on the shorter hue arc, through magenta', () => {
    const [r, g, b] = interpolateSrgb(red, blue, 0.5, 'oklch');
    expect(r).toBeGreaterThan(0.6);
    expect(b).toBeGreaterThan(0.6);
    expect(g).toBeLessThan(0.2);
  });

  it('hue "longer" goes the other way round, through green', () => {
    const [h] = srgbToHsl(...interpolateSrgb(red, blue, 0.5, 'hsl', 'longer'));
    expect(h).toBeCloseTo(120, 6);
    const [r, g, b] = interpolateSrgb(red, blue, 0.5, 'oklch', 'longer');
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
  });

  it('hue wraps through 0° on the shorter arc', () => {
    // hsl(330°) → hsl(30°): the short way is 60° through red, not 300° through cyan.
    const from = hslToSrgb(330, 1, 0.5);
    const to = hslToSrgb(30, 1, 0.5);
    const [h] = srgbToHsl(...interpolateSrgb(from, to, 0.5, 'hsl'));
    expect(h).toBeCloseTo(0, 6);
    const [hq] = srgbToHsl(...interpolateSrgb(from, to, 0.25, 'hsl'));
    expect(hq).toBeCloseTo(345, 6);
  });

  it('an achromatic endpoint borrows the other endpoint\'s hue', () => {
    const white: Rgb = [1, 1, 1];
    const [h, s] = srgbToHsl(...interpolateSrgb(blue, white, 0.5, 'hsl'));
    expect(h).toBeCloseTo(240, 6);
    expect(s).toBeCloseTo(0.5, 6);
    const [r, g, b] = interpolateSrgb(blue, white, 0.5, 'oklch');
    expect(b).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(g);
  });

  it('keeps OKLab and OKLCH output inside the sRGB gamut', () => {
    for (const space of ['oklab', 'oklch'] as const) {
      for (let i = 0; i <= 10; i++) {
        for (const v of interpolateSrgb([0, 1, 0], [1, 0, 1], i / 10, space)) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});
