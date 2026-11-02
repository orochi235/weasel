import { describe, expect, it } from 'vitest';
import { cubicEvalAt } from '../curve';
import { dipsFor, segmentLength, segmentTAtLength, speedDips } from './segmentLength';

const K = 0.5522847498;
/** A quarter circle of radius 100 about the origin, from +x to +y. */
const quarter = [100, 0, 100, 100 * K, 100 * K, 100, 0, 100];
/** The same quarter circle turned into the plane x = 0, running from +z to +y. */
const upright = [0, 0, 100, 0, 100 * K, 100, 0, 100, 100 * K, 0, 100, 0];

type Cubic = [number, number, number, number, number, number, number, number];

/** A cubic's length and its parameter at a run of length, from a million chords. */
function denseWalk(c: Cubic): { length: number; tAt(s: number): number } {
  const n = 1_000_000;
  const cum = new Float64Array(n + 1);
  let [px, py] = cubicEvalAt(...c, 0);
  for (let i = 1; i <= n; i++) {
    const [x, y] = cubicEvalAt(...c, i / n);
    cum[i] = cum[i - 1] + Math.hypot(x - px, y - py);
    px = x;
    py = y;
  }
  const tAt = (s: number) => {
    let lo = 0, hi = n;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] < s) lo = m; else hi = m; }
    return (lo + (s - cum[lo]) / (cum[hi] - cum[lo])) / n;
  };
  return { length: cum[n], tAt };
}

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

  it('settles a cusp or a speed dip that sits beside a panel edge', () => {
    // A cusp at t = 0.752, just inside the panel from 0.75, and a dip at the edge 0.5.
    const cases: [string, number[]][] = [
      ['cusp at 0.752', [0, 0, 100, 100, 0, 100, 55.081485, 89.124038]],
      ['dip at 0.5', [0, 0, 100, 100, 0, 100.5, 100, 0]],
    ];
    for (const [name, c] of cases) {
      const ref = denseWalk(c as Cubic);
      const total = segmentLength(c, 2);
      expect(Math.abs(total - ref.length) / ref.length, name).toBeLessThan(1e-8);
      expect(Math.abs(segmentTAtLength(c, 2, 0.9 * total) - ref.tAt(0.9 * ref.length)), name).toBeLessThan(1e-8);
    }
  });

  it("settles a dip's shoulder in the panel across an edge", () => {
    // Its slowest point is at 0.6259, just past the edge at 0.625; its only component root is at 0.62798.
    const c: Cubic = [0, 0, 100, 100, -50, 40, 92.62712165, 87.5312398];
    const ref = denseWalk(c);
    expect(Math.abs(segmentLength(c, 2) - ref.length) / ref.length).toBeLessThan(1e-9);
  });

  it('decides which roots hide a dip the same way however the curve is turned', () => {
    const turned = (c: number[], th: number) => c.map((v, i) => (i % 2 === 0
      ? v * Math.cos(th) - c[i + 1] * Math.sin(th) : c[i - 1] * Math.sin(th) + v * Math.cos(th)));
    const smooth = [0, 0, 0, 100, 100, 100, 100, 0];
    const dip = [0, 0, 100, 100, 0, 120, 100, 0];
    for (const th of [0, 0.6, 1.2, 2, 2.9]) {
      expect(dipsFor(speedDips(turned(smooth, th), 2), 1 / 8), `smooth at ${th}`).toEqual([]);
      // The dip's slowest point is near t = 0.523.
      expect(dipsFor(speedDips(turned(dip, th), 2), 1 / 8).some((t) => Math.abs(t - 0.523) < 0.01), `dip at ${th}`).toBe(true);
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
