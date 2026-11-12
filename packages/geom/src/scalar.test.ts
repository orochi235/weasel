import { describe, it, expect } from 'vitest';
import { clamp, clamp01, cross, dot, sub, len2, sign, approxEq, lerp, trimNumber, minOf, maxOf, EPS } from './scalar';

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

describe('clamp', () => {
  it('holds v to the bounds, inclusive at each end', () => {
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(10, 0, 10)).toBe(10);
    expect(clamp(11, 0, 10)).toBe(10);
  });
  it('lets lo win when the bounds cross, wherever v sits', () => {
    expect(clamp(-5, 10, 0)).toBe(10);
    expect(clamp(5, 10, 0)).toBe(10);
    expect(clamp(15, 10, 0)).toBe(10);
  });
  it('passes NaN through', () => {
    expect(clamp(NaN, 0, 1)).toBeNaN();
    expect(clamp(NaN, 1, 0)).toBeNaN();
  });
});

describe('clamp01', () => {
  it('holds v to 0..1', () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(0)).toBe(0);
    expect(clamp01(0.25)).toBe(0.25);
    expect(clamp01(1)).toBe(1);
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(-Infinity)).toBe(0);
    expect(clamp01(Infinity)).toBe(1);
  });
  it('passes NaN through', () => {
    expect(clamp01(NaN)).toBeNaN();
  });
});

describe('lerp', () => {
  it('lands on b itself at t = 1, where a + (b - a) * t misses it by an ulp', () => {
    expect(0.7 + (0.1 - 0.7) * 1).not.toBe(0.1);
    expect(lerp(0.7, 0.1, 1)).toBe(0.1);
    expect(lerp(100.1, 0.3, 1)).toBe(0.3);
    expect(lerp(0.7, 0.1, 0)).toBe(0.7);
    expect(lerp(0, 4, 0.25)).toBe(1);
  });
});

describe('trimNumber', () => {
  it('rounds to six places by default, or the places asked for', () => {
    expect(trimNumber(1.23456789)).toBe('1.234568');
    expect(trimNumber(1.23456789, 4)).toBe('1.2346');
    expect(trimNumber(2)).toBe('2');
  });
  it('writes no minus zero, and 0 for a non-finite value', () => {
    expect(trimNumber(-0.0000001)).toBe('0');
    expect(trimNumber(NaN)).toBe('0');
    expect(trimNumber(Infinity)).toBe('0');
  });
  it('writes a number too large to scale by its places as it is (shrunk from svg\'s exporter property)', () => {
    expect(trimNumber(1e303)).toBe('1e+303');
    expect(trimNumber(-Number.MAX_VALUE)).toBe(String(-Number.MAX_VALUE));
  });
});

describe('minOf and maxOf', () => {
  it('answer as a spread of Math.min and Math.max would', () => {
    expect(minOf([3, -1, 2])).toBe(-1);
    expect(maxOf([3, -1, 2])).toBe(3);
    expect(minOf([])).toBe(Infinity);
    expect(maxOf([])).toBe(-Infinity);
    expect(minOf([1, NaN, 0])).toBeNaN();
    expect(maxOf(new Set([1, 5]))).toBe(5);
    expect(maxOf([{ w: 4 }, { w: 9 }], (b) => b.w)).toBe(9);
    expect(minOf(['a', 'b'], (_, i) => i + 10)).toBe(10);
  });

  it('read 200,000 values without overflowing the call stack', () => {
    const many = Array.from({ length: 200_000 }, (_, i) => i - 7);
    expect(minOf(many)).toBe(-7);
    expect(maxOf(many, (v) => v * 2)).toBe(2 * (200_000 - 8));
  });
});
