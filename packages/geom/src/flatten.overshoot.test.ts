import { describe, expect, it } from 'vitest';
import { flattenCubic, flattenQuadratic } from './flatten';
import { pathFromD } from './paths/pathFromD';
import { boundsOfPath } from './paths/bounds';
import { extractPolylines } from './tessellate/polyline';

const xs = (flat: number[]): number[] => flat.filter((_, i) => i % 2 === 0);

describe('flattening a curve whose control points lie on its chord line', () => {
  it('follows a quadratic that overshoots its end', () => {
    // x(t) = 400t - 300t², y = 0: peaks at t = 2/3 with x = 133.33.
    const out: number[] = [];
    flattenQuadratic(0, 0, 200, 0, 100, 0, 0.5, out);
    expect(Math.max(...xs(out))).toBeGreaterThan(133.33 - 0.5);
    expect(out.slice(-2)).toEqual([100, 0]);
  });

  it('follows a cubic that backs up past its start', () => {
    // x(t) = -300t(1-t)² + 100t³ with controls (-100, 0), (0, 0), end (100, 0);
    // x'(t) = 0 at t = 1 - √½ = 0.2929, where x = 100(1 - √2) = -41.42.
    const out: number[] = [];
    flattenCubic(0, 0, -100, 0, 0, 0, 100, 0, 0.5, out);
    expect(Math.min(...xs(out))).toBeLessThan(-41.42 + 0.5);
  });

  it('agrees with the exact bounds of the path', () => {
    const path = pathFromD('M0 0 Q200 0 100 0');
    const flat = extractPolylines(path)[0].points;
    expect(Math.max(...xs(flat))).toBeCloseTo(boundsOfPath(path).x + boundsOfPath(path).width, 0);
  });

  it('still takes a straight curve in one segment', () => {
    const out: number[] = [];
    flattenCubic(0, 0, 30, 0, 60, 0, 90, 0, 0.5, out);
    expect(out).toEqual([90, 0]);
  });
});
