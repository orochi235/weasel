import { describe, expect, it } from 'vitest';
import { powScale, warpScale } from './warp';

describe('warpScale', () => {
  const cube = warpScale({ domain: [0, 2], range: [0, 8], to: (v) => v ** 3, from: (w) => Math.cbrt(w) });

  it('maps linearly in the warped value and inverts through `from`', () => {
    expect(cube.kind).toBe('warp');
    expect(cube.map(0)).toBe(0);
    expect(cube.map(1)).toBe(1);
    expect(cube.position(2)).toBe(8);
    expect(cube.invert(1)).toBeCloseTo(1, 12);
    expect(cube.invert(cube.map(1.5))).toBeCloseTo(1.5, 12);
  });

  it('runs either way round', () => {
    const down = warpScale({ domain: [0, 2], range: [8, 0], to: (v) => v ** 3, from: Math.cbrt });
    expect(down.map(1)).toBe(7);
    expect(down.invert(7)).toBeCloseTo(1, 12);
  });

  it('puts an empty domain at the middle of the range, and an empty range at the domain start', () => {
    const point = warpScale({ domain: [3, 3], range: [0, 10], to: (v) => v, from: (w) => w });
    expect(point.map(3)).toBe(5);
    expect(warpScale({ domain: [1, 4], range: [2, 2], to: Math.sqrt, from: (w) => w * w }).invert(2)).toBe(1);
  });

  it('ticks and labels in value units, as a linear scale does', () => {
    expect(cube.ticks()).toEqual([0, 0.5, 1, 1.5, 2]);
    expect(cube.format(1.5)).toBe('1.5');
    expect(cube.tickFormat(5)(1)).toBe('1');
  });
});

describe('powScale', () => {
  it('is a warp by `exponent`, so 0.5 is a square-root scale', () => {
    const sqrt = powScale({ domain: [0, 100], range: [0, 1], exponent: 0.5 });
    expect(sqrt.kind).toBe('pow');
    expect(sqrt.exponent).toBe(0.5);
    expect(sqrt.map(25)).toBeCloseTo(0.5, 12);
    expect(sqrt.invert(0.5)).toBeCloseTo(25, 12);
  });

  it('keeps the sign of a negative value', () => {
    const sqrt = powScale({ domain: [-100, 100], range: [0, 1], exponent: 0.5 });
    expect(sqrt.map(-25)).toBeCloseTo(0.25, 12);
    expect(sqrt.map(0)).toBeCloseTo(0.5, 12);
    expect(sqrt.invert(0.25)).toBeCloseTo(-25, 12);
  });

  it('refuses an exponent of zero', () => {
    expect(() => powScale({ domain: [0, 1], range: [0, 1], exponent: 0 })).toThrow(/exponent/);
  });
});
