import { describe, it, expect } from 'vitest';
import { nearestOnLine, nearestOnQuadratic, nearestOnCubic, nearestOnPath } from './nearest';
import { cubicEvalAt } from './curve';
import { PATH_M, PATH_L, PATH_Q, PATH_C, PATH_Z } from './commands';

describe('nearestOnLine', () => {
  it('drops a perpendicular onto the interior', () => {
    expect(nearestOnLine(5, 3, 0, 0, 10, 0)).toEqual({ x: 5, y: 0, t: 0.5, dist: 3 });
  });

  it('clamps to the endpoints', () => {
    expect(nearestOnLine(-4, 3, 0, 0, 10, 0)).toEqual({ x: 0, y: 0, t: 0, dist: 5 });
    expect(nearestOnLine(14, -3, 0, 0, 10, 0)).toEqual({ x: 10, y: 0, t: 1, dist: 5 });
  });

  it('answers t = 0 on a zero-length segment', () => {
    expect(nearestOnLine(3, 4, 0, 0, 0, 0)).toEqual({ x: 0, y: 0, t: 0, dist: 5 });
  });
});

/** Deterministic PRNG so the brute-force comparison is reproducible. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function bruteCubic(px: number, py: number, c: readonly number[]): number {
  let best = Infinity;
  const n = 200_000;
  for (let k = 0; k <= n; k++) {
    const [x, y] = cubicEvalAt(c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], k / n);
    best = Math.min(best, Math.hypot(x - px, y - py));
  }
  return best;
}

describe('nearestOnCubic', () => {
  const S = [0, 0, 0, 10, 10, 10, 10, 0] as const;

  it('finds a point lying on the curve at distance zero', () => {
    const [x, y] = cubicEvalAt(...S, 0.37);
    const hit = nearestOnCubic(x, y, ...S);
    expect(hit.t).toBeCloseTo(0.37, 9);
    expect(hit.dist).toBeCloseTo(0, 9);
  });

  it('answers the apex of a symmetric arch from directly above', () => {
    const hit = nearestOnCubic(5, 20, ...S);
    expect(hit.t).toBeCloseTo(0.5, 9);
    expect(hit.x).toBeCloseTo(5, 9);
    expect(hit.y).toBeCloseTo(7.5, 9);
    expect(hit.dist).toBeCloseTo(12.5, 9);
  });

  it('lands exactly on an endpoint when the probe lies beyond it', () => {
    const start = nearestOnCubic(-3, -4, ...S);
    expect(start).toEqual({ x: 0, y: 0, t: 0, dist: 5 });
    const end = nearestOnCubic(13, -4, ...S);
    expect(end).toEqual({ x: 10, y: 0, t: 1, dist: 5 });
  });

  it('finds the tip of a cusp, where the derivative vanishes', () => {
    // B'(0.5) = 0 for these controls; the cusp tip is (0.5, 0.75).
    const cusp = [0, 0, 1, 1, 0, 1, 1, 0] as const;
    const hit = nearestOnCubic(0.5, 1, ...cusp);
    expect(hit.t).toBeCloseTo(0.5, 6);
    expect(hit.x).toBeCloseTo(0.5, 9);
    expect(hit.y).toBeCloseTo(0.75, 9);
    expect(hit.dist).toBeCloseTo(0.25, 9);
  });

  it('picks the global minimum across a self-intersecting loop', () => {
    // A loop: the probe sits equidistant-ish from two arms; brute force decides.
    const loop = [0, 0, 12, 10, -2, 10, 10, 0] as const;
    const hit = nearestOnCubic(5, 4, ...loop);
    expect(hit.dist).toBeLessThanOrEqual(bruteCubic(5, 4, loop) + 1e-9);
  });

  it('matches dense brute-force sampling on random curves and probes', () => {
    const r = rng(7);
    for (let i = 0; i < 40; i++) {
      const c = Array.from({ length: 8 }, () => r() * 200 - 100);
      const px = r() * 300 - 150, py = r() * 300 - 150;
      const hit = nearestOnCubic(px, py, c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7]);
      const brute = bruteCubic(px, py, c);
      expect(hit.dist, `case ${i}`).toBeLessThanOrEqual(brute + 1e-9);
      expect(hit.dist, `case ${i}`).toBeGreaterThan(brute - 1e-6);
      const [x, y] = cubicEvalAt(c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], hit.t);
      expect(hit.x).toBeCloseTo(x, 9);
      expect(hit.y).toBeCloseTo(y, 9);
    }
  });

  it('handles a curve collapsed to a single point', () => {
    expect(nearestOnCubic(3, 4, 0, 0, 0, 0, 0, 0, 0, 0)).toMatchObject({ x: 0, y: 0, dist: 5 });
  });
});

describe('nearestOnQuadratic', () => {
  it('answers the apex of a parabola from directly above', () => {
    // B(0.5) = (2, 2) for q0=(0,0) c=(2,4) q1=(4,0).
    const hit = nearestOnQuadratic(2, 5, 0, 0, 2, 4, 4, 0);
    expect(hit.t).toBeCloseTo(0.5, 9);
    expect(hit.x).toBeCloseTo(2, 9);
    expect(hit.y).toBeCloseTo(2, 9);
    expect(hit.dist).toBeCloseTo(3, 9);
  });

  it('clamps to an endpoint', () => {
    expect(nearestOnQuadratic(-3, -4, 0, 0, 2, 4, 4, 0)).toEqual({ x: 0, y: 0, t: 0, dist: 5 });
  });
});

describe('nearestOnPath', () => {
  // M 0,0  L 10,0  Q 20,0 20,10  C 20,20 0,20 0,10  Z
  const commands = Uint8Array.of(PATH_M, PATH_L, PATH_Q, PATH_C, PATH_Z);
  const coords = Float64Array.of(0, 0, 10, 0, 20, 0, 20, 10, 20, 20, 0, 20, 0, 10);

  it('reports the line segment it lands on', () => {
    expect(nearestOnPath(commands, coords, 5, -2)).toEqual({
      x: 5, y: 0, t: 0.5, dist: 2, commandIndex: 1, coordIndex: 2,
    });
  });

  it('reports the quadratic segment it lands on', () => {
    const hit = nearestOnPath(commands, coords, 30, 10)!;
    expect(hit.commandIndex).toBe(2);
    expect(hit.coordIndex).toBe(4);
    expect(hit.t).toBeCloseTo(1, 9);
    expect(hit.dist).toBeCloseTo(10, 9);
  });

  it('reports the cubic segment it lands on', () => {
    const hit = nearestOnPath(commands, coords, 10, 30)!;
    expect(hit.commandIndex).toBe(3);
    expect(hit.coordIndex).toBe(8);
    expect(hit.t).toBeCloseTo(0.5, 9);
    expect(hit.y).toBeCloseTo(17.5, 9);
  });

  it('includes the closing edge a Z draws back to the subpath start', () => {
    const hit = nearestOnPath(commands, coords, -2, 5)!;
    expect(hit).toEqual({ x: 0, y: 5, t: 0.5, dist: 2, commandIndex: 4, coordIndex: 14 });
  });

  it('starts a segment after Z at the subpath start, as SVG does', () => {
    // M 0,0  L 10,0  Z  L 0,10  — the last L runs from 0,0, not 10,0.
    const cmds = Uint8Array.of(PATH_M, PATH_L, PATH_Z, PATH_L);
    const cs = Float64Array.of(0, 0, 10, 0, 0, 10);
    const hit = nearestOnPath(cmds, cs, -1, 5)!;
    expect(hit).toEqual({ x: 0, y: 5, t: 0.5, dist: 1, commandIndex: 3, coordIndex: 4 });
  });

  it('keeps the first segment on a tie', () => {
    // Two coincident lines.
    const cmds = Uint8Array.of(PATH_M, PATH_L, PATH_M, PATH_L);
    const cs = Float64Array.of(0, 0, 10, 0, 0, 0, 10, 0);
    expect(nearestOnPath(cmds, cs, 5, 1)!.commandIndex).toBe(1);
  });

  it('throws on an unknown command rather than misreading the coords after it', () => {
    const cmds = Uint8Array.of(PATH_M, 99, PATH_L);
    const cs = Float64Array.of(0, 0, 5, 5, 10, 10);
    expect(() => nearestOnPath(cmds, cs, 0, 0)).toThrow(/unknown command code 99/);
  });

  it('answers null when there is no segment to land on', () => {
    expect(nearestOnPath(new Uint8Array(0), new Float64Array(0), 0, 0)).toBeNull();
    expect(nearestOnPath(Uint8Array.of(PATH_M), Float64Array.of(1, 1), 0, 0)).toBeNull();
  });
});
