import { describe, it, expect } from 'vitest';
import { cubicEvalAt, elevateQuadraticToCubic, flattenCubic, cubicBounds } from './curve';
import { approxEq } from './scalar';

describe('cubicEvalAt', () => {
  it('hits the endpoints at t=0 and t=1', () => {
    const p0: [number, number] = [0, 0], p1: [number, number] = [1, 2], p2: [number, number] = [3, 2], p3: [number, number] = [4, 0];
    expect(cubicEvalAt(...p0, ...p1, ...p2, ...p3, 0)).toEqual([0, 0]);
    expect(cubicEvalAt(...p0, ...p1, ...p2, ...p3, 1)).toEqual([4, 0]);
  });
});

describe('elevateQuadraticToCubic', () => {
  it('produces a cubic that samples identically to the quadratic', () => {
    // quad: q0=(0,0) c=(2,4) q1=(4,0). Elevated cubic control points:
    //   c1 = q0 + 2/3 (c - q0),  c2 = q1 + 2/3 (c - q1)
    const [c1x, c1y, c2x, c2y] = elevateQuadraticToCubic(0, 0, 2, 4, 4, 0);
    expect(approxEq(c1x, 4 / 3)).toBe(true);
    expect(approxEq(c1y, 8 / 3)).toBe(true);
    expect(approxEq(c2x, 8 / 3)).toBe(true);
    expect(approxEq(c2y, 8 / 3)).toBe(true);
    // sample agreement at t=0.5: quad B(0.5)=(2,2); cubic must match.
    const cub = cubicEvalAt(0, 0, c1x, c1y, c2x, c2y, 4, 0, 0.5);
    expect(approxEq(cub[0], 2)).toBe(true);
    expect(approxEq(cub[1], 2)).toBe(true);
  });
});

describe('flattenCubic', () => {
  it('emits points within tolerance, ending at the endpoint', () => {
    const out: number[] = [];
    flattenCubic(0, 0, 0, 10, 10, 10, 10, 0, 0.5, out);
    expect(out.length).toBeGreaterThanOrEqual(2);
    expect(approxEq(out[out.length - 2], 10)).toBe(true);
    expect(approxEq(out[out.length - 1], 0)).toBe(true);
  });
});

describe('cubicBounds', () => {
  it('is tight — a symmetric arch peaks at y=7.5, not the control y=10', () => {
    // cubic with control points pulling to y=10 actually reaches y=7.5 at apex.
    const b = cubicBounds(0, 0, 0, 10, 10, 10, 10, 0);
    expect(approxEq(b[0], 0)).toBe(true);   // minX
    expect(approxEq(b[1], 0)).toBe(true);   // minY
    expect(approxEq(b[2], 10)).toBe(true);  // maxX
    expect(approxEq(b[3], 7.5)).toBe(true); // maxY (curve apex < control hull)
  });
});

describe('flattenCubic termination', () => {
  it('terminates on a non-finite control point', () => {
    const out: number[] = [];
    expect(() => flattenCubic(0, 0, NaN, 0, 1, 1, 1, 1, 0.5, out)).not.toThrow();
    // Stops at the first level rather than subdividing to the depth cap.
    expect(out).toEqual([1, 1]);
  });

  it('terminates on a zero or negative tolerance', () => {
    for (const tol of [0, -1]) {
      const out: number[] = [];
      expect(() => flattenCubic(0, 0, 0, 100, 100, 100, 100, 0, tol, out)).not.toThrow();
      expect(out.length).toBeLessThanOrEqual(2 * (1 << 16));
    }
  });

  it('is unchanged for ordinary curves at the usual tolerance', () => {
    const out: number[] = [];
    flattenCubic(0, 0, 0, 10, 10, 10, 10, 0, 0.5, out);
    expect(out.length).toBe(16);
  });
});
