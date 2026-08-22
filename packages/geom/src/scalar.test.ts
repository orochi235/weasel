import { describe, it, expect } from 'vitest';
import { cross, dot, sub, len2, sign, approxEq, EPS } from './scalar';

describe('scalar primitives', () => {
  it('cross product is the 2D wedge', () => {
    expect(cross(1, 0, 0, 1)).toBe(1);
    expect(cross(0, 1, 1, 0)).toBe(-1);
  });
  it('dot and len2', () => {
    expect(dot(1, 2, 3, 4)).toBe(11);
    expect(len2(3, 4)).toBe(25);
  });
  it('sub returns the component delta as a tuple', () => {
    expect(sub(5, 7, 2, 3)).toEqual([3, 4]);
  });
  it('sign is the three-valued sign', () => {
    expect(sign(-2)).toBe(-1);
    expect(sign(0)).toBe(0);
    expect(sign(2)).toBe(1);
  });
});

describe('epsilon policy', () => {
  it('treats f32-quantized values as equal at small magnitude', () => {
    // 0.1 stored through Float32 differs from the f64 literal by ~1e-9.
    const stored = Math.fround(0.1);
    expect(approxEq(stored, 0.1)).toBe(true);
  });
  it('scales tolerance with magnitude (f32 ULP at 100k ≈ 0.008)', () => {
    const big = 100_000;
    const storedBig = Math.fround(big + 0.001); // below f32 resolution there
    expect(approxEq(storedBig, big)).toBe(true);
    expect(approxEq(big, big + 1)).toBe(false); // a whole unit is still distinct
  });
  it('exposes a base epsilon at f32 scale, not f64', () => {
    expect(EPS).toBeGreaterThan(1e-7);
    expect(EPS).toBeLessThan(1e-4);
  });
});

describe('approxEq edge cases', () => {
  it('holds for identical infinities', () => {
    expect(approxEq(Infinity, Infinity)).toBe(true);
    expect(approxEq(-Infinity, -Infinity)).toBe(true);
  });
  it('rejects opposite infinities and NaN', () => {
    expect(approxEq(Infinity, -Infinity)).toBe(false);
    expect(approxEq(NaN, NaN)).toBe(false);
    expect(approxEq(NaN, 0)).toBe(false);
    expect(approxEq(Infinity, 1e300)).toBe(false);
  });
});
