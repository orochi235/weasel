/**
 * Property tests of `inTriangle` on whole-pixel points, against an exact brute force: a point is inside, edges
 * included, when the three triangles it makes with the sides add up to the whole, and for a triangle flattened
 * to a segment or a point, when it lies on that segment or is that point. Order and orientation of the corners
 * do not matter.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Point } from './placement';
import { inTriangle } from './triangle';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 1000;

/** Twice the signed area of `oab`, exact for whole numbers under 2^25. */
const area2 = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/** Whether `p` is on the segment `ab`, ends included. */
const onSegment = (p: Point, a: Point, b: Point) => area2(p, a, b) === 0
  && Math.min(a.x, b.x) <= p.x && p.x <= Math.max(a.x, b.x) && Math.min(a.y, b.y) <= p.y && p.y <= Math.max(a.y, b.y);

function brute(p: Point, a: Point, b: Point, c: Point): boolean {
  const whole = Math.abs(area2(a, b, c));
  if (whole > 0) return Math.abs(area2(p, a, b)) + Math.abs(area2(p, b, c)) + Math.abs(area2(p, c, a)) === whole;
  return onSegment(p, a, b) || onSegment(p, b, c) || onSegment(p, c, a);
}

const coordIn = (n: number) => fc.integer({ min: -n, max: n });
const pointIn = (n: number): fc.Arbitrary<Point> => fc.record({ x: coordIn(n), y: coordIn(n) });
/** Points on a small grid, so corners repeat, line up, and points fall on edges; and points across a wide range. */
const point = fc.oneof({ weight: 3, arbitrary: pointIn(3) }, { weight: 1, arbitrary: pointIn(4_000_000) });

/** Three corners on one line (a step apart, so some coincide), and a point on that line or beside it. */
const flat = fc.tuple(pointIn(3), pointIn(2), fc.integer({ min: -3, max: 3 }), fc.integer({ min: -3, max: 3 }), fc.integer({ min: -6, max: 6 }), fc.constantFrom(0, 0, 1))
  .map(([a, d, j, k, m, off]) => {
    const at = (n: number) => ({ x: a.x + n * d.x, y: a.y + n * d.y });
    return [{ x: at(m).x + off, y: at(m).y }, a, at(j), at(k)] as const;
  });

describe('inTriangle', () => {
  it('agrees with the exact brute force, degenerate triangles included, in any corner order', () => {
    const t = tally();
    fc.assert(fc.property(fc.oneof(fc.tuple(point, point, point, point), flat), ([p, a, b, c]) => {
      const want = brute(p, a, b, c);
      for (const [x, y, z] of [[a, b, c], [b, c, a], [c, b, a]] as const) expect(inTriangle(p, x, y, z)).toBe(want);
      const flat = area2(a, b, c) === 0;
      t.count(`${flat ? 'flat' : 'proper'} ${want ? 'in' : 'out'}`);
      if (want && !flat && [area2(p, a, b), area2(p, b, c), area2(p, c, a)].includes(0)) t.count('on an edge');
    }), runs(RUNS));
    for (const what of ['proper in', 'proper out', 'flat in', 'flat out']) t.atLeast(what, RUNS / 40);
    t.atLeast('on an edge', RUNS / 200);
  }, timeoutFor(RUNS, 1));
});

describe('inTriangle, shrunk', () => {
  it('leaves out a point on the line of a flattened triangle but past its ends', () => {
    expect(inTriangle({ x: 5, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 })).toBe(false);
    expect(inTriangle({ x: 1, y: 1 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(false);
    expect(inTriangle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 })).toBe(true);
  });
});
