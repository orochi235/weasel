import { describe, expect, it } from 'vitest';
import { powScale, warpScale } from './warp';

describe('warpScale', () => {
  const cube = warpScale({ domain: [0, 2], range: [0, 8], to: (v) => v ** 3, from: (w) => Math.cbrt(w) });

  it('maps linearly in the warped value and inverts through `from`', () => {
    expect(cube.kind).toBe('warp');
    expect(cube.position(0)).toBe(0);
    expect(cube.position(1)).toBe(1);
    expect(cube.position(2)).toBe(8);
    expect(cube.invert(1)).toBeCloseTo(1, 12);
    expect(cube.invert(cube.position(1.5))).toBeCloseTo(1.5, 12);
  });

  it('runs either way round', () => {
    const down = warpScale({ domain: [0, 2], range: [8, 0], to: (v) => v ** 3, from: Math.cbrt });
    expect(down.position(1)).toBe(7);
    expect(down.invert(7)).toBeCloseTo(1, 12);
  });

  it('puts an empty domain at the middle of the range, and an empty range at the domain start', () => {
    const point = warpScale({ domain: [3, 3], range: [0, 10], to: (v) => v, from: (w) => w });
    expect(point.position(3)).toBe(5);
    expect(warpScale({ domain: [1, 4], range: [2, 2], to: Math.sqrt, from: (w) => w * w }).invert(2)).toBe(1);
  });

  it('ticks on round values spaced evenly along the range, whole ones where the domain has enough, each labeled as written', () => {
    expect(cube.ticks()).toEqual([0, 1, 1.5, 2]);
    expect(cube.format(1.5)).toBe('1.5');
    expect(cube.tickFormat(5)(1)).toBe('1');
    const log1p = warpScale({ domain: [0, 12], range: [0, 1], to: Math.log1p, from: Math.expm1 });
    const ticks = log1p.ticks(4);
    expect(ticks).toEqual([0, 1, 3, 6, 10]);
    expect(ticks.map(log1p.tickFormat(4))).toEqual(['0', '1', '3', '6', '10']);
    const gaps = ticks.slice(1).map((t, i) => log1p.position(t) - log1p.position(ticks[i]!));
    expect(Math.max(...gaps) / Math.min(...gaps)).toBeLessThan(1.6);
  });
});

describe('powScale', () => {
  it('is a warp by `exponent`, so 0.5 is a square-root scale', () => {
    const sqrt = powScale({ domain: [0, 100], range: [0, 1], exponent: 0.5 });
    expect(sqrt.kind).toBe('pow');
    expect(sqrt.exponent).toBe(0.5);
    expect(sqrt.position(25)).toBeCloseTo(0.5, 12);
    expect(sqrt.invert(0.5)).toBeCloseTo(25, 12);
  });

  it('keeps the sign of a negative value', () => {
    const sqrt = powScale({ domain: [-100, 100], range: [0, 1], exponent: 0.5 });
    expect(sqrt.position(-25)).toBeCloseTo(0.25, 12);
    expect(sqrt.position(0)).toBeCloseTo(0.5, 12);
    expect(sqrt.invert(0.25)).toBeCloseTo(-25, 12);
  });

  it('refuses a negative exponent over a domain reaching zero, which it sends to infinity', () => {
    expect(() => powScale({ domain: [0, 10], range: [0, 1], exponent: -1 })).toThrow(/zero/);
    expect(() => powScale({ domain: [-5, 5], range: [0, 1], exponent: -1 })).toThrow(/zero/);
    const inverse = powScale({ domain: [1, 10], range: [0, 1], exponent: -1 });
    expect(inverse.invert(inverse.position(4))).toBeCloseTo(4, 12);
  });

  it('refuses an exponent of zero', () => {
    expect(() => powScale({ domain: [0, 1], range: [0, 1], exponent: 0 })).toThrow(/exponent/);
  });

  it('formats a value as its own ticks label it', () => {
    for (const domain of [[0, 4], [0, 1]] as const) {
      const s = powScale({ domain, range: [0, 100], exponent: 0.5 });
      expect(s.ticks().map(s.format)).toEqual(s.ticks().map(s.tickFormat()));
      expect(new Set(s.ticks().map(s.format)).size).toBe(s.ticks().length);
    }
    expect(powScale({ domain: [0, 4], range: [0, 100], exponent: 0.5 }).format(0.15)).toBe('0.15');
  });

  it('ticks a domain narrower than its distance from zero on the round steps a linear scale would', () => {
    expect(powScale({ domain: [101, 109], range: [0, 100], exponent: 2 }).ticks()).toEqual([102, 104, 106, 108]);
    expect(powScale({ domain: [1265, 1279], range: [0, 100], exponent: 0.5 }).ticks()).toEqual([1266, 1268, 1270, 1272, 1274, 1276, 1278]);
    expect(powScale({ domain: [1265, 1295], range: [0, 100], exponent: 0.5 }).ticks()).toEqual([1265, 1270, 1275, 1280, 1285, 1290, 1295]);
    expect(powScale({ domain: [95, 109], range: [0, 100], exponent: 0.5 }).ticks()).toEqual([96, 98, 100, 102, 104, 106, 108]);
    const near = powScale({ domain: [1.1, 1.3], range: [0, 100], exponent: 0.5 });
    expect(near.ticks()).toEqual([1.1, 1.15, 1.2, 1.25, 1.3]);
    expect(near.ticks().map(near.format)).toEqual(['1.1', '1.15', '1.2', '1.25', '1.3']);
    expect(powScale({ domain: [100, 110], range: [0, 100], exponent: 2 }).ticks()).toEqual([100, 102, 104, 106, 108, 110]);
    expect(powScale({ domain: [-109, -101], range: [0, 100], exponent: 2 }).ticks().length).toBeGreaterThan(3);
  });
});

