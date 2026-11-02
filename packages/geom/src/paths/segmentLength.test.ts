import { describe, expect, it } from 'vitest';
import { cubicEvalAt } from '../curve';
import { segmentLength, segmentTAtLength } from './segmentLength';

const K = 0.5522847498;
/** A quarter circle of radius 100 about the origin, from +x to +y. */
const quarter = [100, 0, 100, 100 * K, 100 * K, 100, 0, 100];
/** The same quarter circle turned into the plane x = 0, running from +z to +y. */
const upright = [0, 0, 100, 0, 100 * K, 100, 0, 100, 100 * K, 0, 100, 0];

describe('segmentLength', () => {
  it('measures a quarter circle of radius 100 as a quarter of its circumference', () => {
    expect(segmentLength(quarter, 2)).toBeCloseTo(50 * Math.PI, 1);
  });

  it('measures a sub-range', () => {
    expect(segmentLength(quarter, 2, 0, 0.5)).toBeCloseTo(segmentLength(quarter, 2) / 2, 3);
  });

  it('measures a line, and a quadratic', () => {
    expect(segmentLength([0, 0, 3, 4], 2)).toBe(5);
    expect(segmentLength([0, 0, 5, 0, 10, 0], 2)).toBeCloseTo(10, 9);
  });

  it('measures in three components', () => {
    expect(segmentLength([0, 0, 0, 1, 2, 2], 3)).toBe(3);
    expect(segmentLength(upright, 3)).toBeCloseTo(segmentLength(quarter, 2), 9);
  });
});

describe('segmentTAtLength', () => {
  it('finds the parameter at a given run of arc length', () => {
    const [x, y] = cubicEvalAt(...(quarter as [number, number, number, number, number, number, number, number]),
      segmentTAtLength(quarter, 2, 25 * Math.PI));
    expect(Math.atan2(y, x)).toBeCloseTo(Math.PI / 4, 3);
  });

  it('stays exact across a cusp', () => {
    // Both derivatives vanish at t = 0.5, which a single Gauss–Legendre rule per panel misses by 0.01 units.
    const cusp = [0, 0, 100, 100, 0, 100, 100, 0] as const;
    const n = 200_000;
    const cum = [0];
    let prev = cubicEvalAt(...cusp, 0);
    for (let i = 1; i <= n; i++) {
      const p = cubicEvalAt(...cusp, i / n);
      cum.push(cum[i - 1] + Math.hypot(p[0] - prev[0], p[1] - prev[1]));
      prev = p;
    }
    expect(segmentLength(cusp, 2)).toBeCloseTo(cum[n], 6);
    for (const f of [0.3, 0.6, 0.85]) {
      let i = 1;
      while (cum[i] < f * cum[n]) i++;
      expect(segmentTAtLength(cusp, 2, f * cum[n]), `f ${f}`).toBeCloseTo(i / n, 4);
    }
  });

  it('answers at once for a coordinate that is not finite', () => {
    const t0 = performance.now();
    for (const bad of [NaN, Infinity, -Infinity]) {
      const c = [0, 0, bad, 1, 2, 1, 3, 0];
      expect(segmentLength(c, 2)).toBeNaN();
      expect(segmentTAtLength(c, 2, 1)).toBe(0);
    }
    expect(performance.now() - t0).toBeLessThan(50);
  });

  it('measures a cusp the same at any scale', () => {
    const at = (k: number) => [0, 0, 100 * k, 100 * k, 0, 100 * k, 100 * k, 0];
    for (const k of [1e-9, 1e-3, 1e6]) {
      expect(segmentLength(at(k), 2) / k, `scale ${k}`).toBeCloseTo(segmentLength(at(1), 2), 6);
      expect(segmentTAtLength(at(k), 2, segmentLength(at(k), 2) * 0.6), `scale ${k}`)
        .toBeCloseTo(segmentTAtLength(at(1), 2, segmentLength(at(1), 2) * 0.6), 6);
    }
  });

  it('takes a total the caller already has', () => {
    const total = segmentLength(quarter, 2);
    expect(segmentTAtLength(quarter, 2, total / 2, total)).toBe(segmentTAtLength(quarter, 2, total / 2));
  });

  it('clamps to the ends', () => {
    expect(segmentTAtLength(quarter, 2, -5)).toBe(0);
    expect(segmentTAtLength(quarter, 2, 1e6)).toBe(1);
  });
});
