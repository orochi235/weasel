/**
 * `simplifyStops` against the polyline it was given: it keeps the ends, keeps a subsequence of the points in order,
 * leaves no repeat and no interior point straight between its neighbors, runs over every point it dropped, and does
 * nothing a second time.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Vec2 } from '@weasel-js/core/math';
import { coord, point, runs, tally, timeoutFor } from './pbt.fixture';
import { simplifyStops } from './polyline';

const RUNS = 400;

/** A walk on a coarse grid, so repeats, straight runs, and doubling back all come up. */
const walk: fc.Arbitrary<Vec2[]> = fc.oneof(
  { weight: 3, arbitrary: fc.tuple(point(), fc.array(fc.tuple(fc.integer({ min: -2, max: 2 }), fc.integer({ min: -2, max: 2 })), { maxLength: 12 }))
    .map(([start, steps]) => steps.reduce<Vec2[]>((out, [dx, dy]) => {
      const last = out[out.length - 1]!;
      return [...out, { x: last.x + dx * 10, y: last.y + dy * 10 }];
    }, [start])) },
  { weight: 1, arbitrary: fc.array(point(coord), { minLength: 1, maxLength: 10 }) },
);

/** How far `p` lies from the segment from `a` to `b`. */
function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const [dx, dy] = [b.x - a.x, b.y - a.y];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

describe('simplifyStops', () => {
  it('keeps the ends and a subsequence of the points, with no repeat and no stop between its neighbors', () => {
    const seen = tally();
    fc.assert(fc.property(walk, (points) => {
      const out = simplifyStops(points);
      if (out.length < points.length) seen.count('dropped');
      expect(out[0]).toBe(points[0]);
      const last = points[points.length - 1]!;
      expect(Math.abs(out[out.length - 1]!.x - last.x)).toBeLessThanOrEqual(1e-6);
      expect(Math.abs(out[out.length - 1]!.y - last.y)).toBeLessThanOrEqual(1e-6);
      let k = 0;
      for (const p of out) {
        while (k < points.length && points[k] !== p) k++;
        expect(k).toBeLessThan(points.length);
      }
      for (let i = 1; i < out.length; i++) {
        expect(Math.abs(out[i]!.x - out[i - 1]!.x) > 1e-6 || Math.abs(out[i]!.y - out[i - 1]!.y) > 1e-6).toBe(true);
      }
      for (let i = 1; i + 1 < out.length; i++) {
        const [a, m, b] = [out[i - 1]!, out[i]!, out[i + 1]!];
        const cross = (m.x - a.x) * (b.y - a.y) - (m.y - a.y) * (b.x - a.x);
        const dot = (m.x - a.x) * (b.x - m.x) + (m.y - a.y) * (b.y - m.y);
        expect(Math.abs(cross) > 1e-6 || dot <= 0).toBe(true);
      }
    }), runs(RUNS));
    seen.atLeast('dropped', RUNS / 6);
  }, timeoutFor(RUNS, 1));

  it('runs over every point it dropped, and changes nothing a second time', () => {
    fc.assert(fc.property(walk, (points) => {
      const out = simplifyStops(points);
      for (const p of points) {
        const near = out.length === 1 ? Math.hypot(p.x - out[0]!.x, p.y - out[0]!.y)
          : Math.min(...out.slice(1).map((b, i) => distToSegment(p, out[i]!, b)));
        if (out.length > 1 || points.every((q) => Math.hypot(q.x - out[0]!.x, q.y - out[0]!.y) <= 1e-6)) {
          expect(near).toBeLessThanOrEqual(1e-6);
        }
      }
      expect(simplifyStops(out)).toEqual(out);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});
