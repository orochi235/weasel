/**
 * The clipper's laws: whatever it keeps lies inside the area and on the input, input already inside comes back as it
 * went in, clipping twice is clipping once, and two convex polygons cut to each other cover the same area either way
 * round. Areas are rects of any size and circles' polygons; points reach far past them and to infinity.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, tally, timeoutFor } from '../pbt.fixture';
import { circleArea, clipPolygon, clipPolyline, insideArea, rectArea, type ConvexArea } from './clip';
import type { PlotPoint } from './types';

const RUNS = 300;

const coord = fc.oneof(
  { weight: 6, arbitrary: fc.integer({ min: -300, max: 300 }) },
  { weight: 3, arbitrary: fc.double({ min: -1000, max: 1000, noNaN: true }) },
  { weight: 1, arbitrary: fc.constantFrom(1e12, -1e12, 1e300, -1e300, Infinity, -Infinity) },
);
const point: fc.Arbitrary<PlotPoint> = fc.record({ x: coord, y: coord });
const rect = fc.record({
  x: fc.integer({ min: -200, max: 200 }), y: fc.integer({ min: -200, max: 200 }),
  width: fc.integer({ min: 1, max: 400 }), height: fc.integer({ min: 1, max: 400 }),
});
const area: fc.Arbitrary<ConvexArea> = fc.oneof(
  rect.map(rectArea),
  rect.map((r) => [...rectArea(r)].reverse()),
  fc.tuple(fc.integer({ min: -100, max: 100 }), fc.integer({ min: -100, max: 100 }), fc.integer({ min: 1, max: 200 }), fc.integer({ min: 3, max: 12 }))
    .map(([x, y, r, sides]) => circleArea({ x, y }, r, sides)),
);

const breadth = (a: ConvexArea): number => Math.hypot(
  Math.max(...a.map((p) => p.x)) - Math.min(...a.map((p) => p.x)), Math.max(...a.map((p) => p.y)) - Math.min(...a.map((p) => p.y)),
);
/** Whether `p` lies inside `a`, give or take `tol` of its breadth. */
function insideNear(a: ConvexArea, p: PlotPoint, tol = 1e-9): boolean {
  if (insideArea(a, p)) return true;
  const c = { x: a.reduce((s, q) => s + q.x, 0) / a.length, y: a.reduce((s, q) => s + q.y, 0) / a.length };
  const d = Math.hypot(p.x - c.x, p.y - c.y);
  const k = Math.max(0, 1 - (tol * breadth(a)) / d);
  return insideArea(a, { x: c.x + (p.x - c.x) * k, y: c.y + (p.y - c.y) * k });
}
const shoelace = (pts: readonly PlotPoint[]): number =>
  Math.abs(pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]!; return s + p.x * q.y - q.x * p.y; }, 0)) / 2;
const inArea = (a: ConvexArea) => fc.tuple(fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }))
  .map(([u, v]) => {
    // A point in the triangle fan from the first corner, so it lies inside.
    const i = 1 + Math.floor(u * (a.length - 2.0001));
    const [p, q, r] = [a[0]!, a[i]!, a[i + 1]!];
    const [s, t] = u + v > 1 ? [1 - u, 1 - v] : [u, v];
    return { x: p.x + s * (q.x - p.x) + t * (r.x - p.x), y: p.y + s * (q.y - p.y) + t * (r.y - p.y) };
  });

describe('clipPolyline', () => {
  it('keeps only points inside the area, finite, and a polyline wholly inside whole', () => {
    const seen = tally();
    fc.assert(fc.property(area, fc.array(point, { maxLength: 8 }), (a, pts) => {
      const out = clipPolyline(a, pts);
      for (const run of out) {
        expect(run.length).toBeGreaterThan(0);
        for (const p of run) {
          expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
          expect(insideNear(a, p)).toBe(true);
        }
      }
      if (out.length > 0) seen.count('kept');
      if (pts.length > 0 && pts.every((p) => insideArea(a, p))) {
        seen.count('inside');
        expect(out).toEqual([pts.map((p) => ({ x: p.x, y: p.y }))]);
      }
    }), runs(RUNS));
    seen.atLeast('kept', RUNS / 10);
    seen.atLeast('inside', 5);
  }, timeoutFor(RUNS, 1));

  it('keeps a polyline inside whole, and clipping a run again keeps it as it is', () => {
    fc.assert(fc.property(area.chain((a) => fc.tuple(fc.constant(a), fc.array(inArea(a), { minLength: 1, maxLength: 6 }), fc.array(point, { maxLength: 6 }))),
      ([a, inner, outer]) => {
        // A point the fan places on an edge can round just past it.
        fc.pre(inner.every((p) => insideArea(a, p)));
        expect(clipPolyline(a, inner)).toEqual([inner]);
        for (const run of clipPolyline(a, [...outer, ...inner])) {
          const again = clipPolyline(a, run);
          expect(again.length).toBe(1);
          expect(again[0]!.length).toBe(run.length);
          again[0]!.forEach((p, i) => {
            expect(Math.abs(p.x - run[i]!.x)).toBeLessThanOrEqual(1e-9 * breadth(a));
            expect(Math.abs(p.y - run[i]!.y)).toBeLessThanOrEqual(1e-9 * breadth(a));
          });
        }
      }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});

describe('clipPolygon', () => {
  it('keeps a polygon\'s points inside the area, finite, and one wholly inside as it is', () => {
    const seen = tally();
    fc.assert(fc.property(area, fc.array(point, { maxLength: 8 }), (a, pts) => {
      const out = clipPolygon(a, pts);
      for (const p of out) {
        expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
        expect(insideNear(a, p)).toBe(true);
      }
      if (out.length > 2) seen.count('kept');
      if (pts.length > 0 && pts.every((p) => insideArea(a, p))) expect(out).toEqual(pts.map((p) => ({ x: p.x, y: p.y })));
    }), runs(RUNS));
    seen.atLeast('kept', RUNS / 10);
  }, timeoutFor(RUNS, 1));

  it('cuts two convex areas to the same overlap either way round, no larger than either, and an area to itself whole', () => {
    const seen = tally();
    fc.assert(fc.property(area, area, (a, b) => {
      const ab = shoelace(clipPolygon(a, b));
      const ba = shoelace(clipPolygon(b, a));
      expect(Math.abs(ab - ba)).toBeLessThanOrEqual(1e-6 * Math.max(1, shoelace(a), shoelace(b)));
      expect(ab).toBeLessThanOrEqual(Math.min(shoelace(a), shoelace(b)) * (1 + 1e-6) + 1e-6);
      expect(Math.abs(shoelace(clipPolygon(a, a)) - shoelace(a))).toBeLessThanOrEqual(1e-6 * Math.max(1, shoelace(a)));
      if (ab > 0) seen.count('overlap');
    }), runs(RUNS));
    seen.atLeast('overlap', RUNS / 10);
  }, timeoutFor(RUNS, 1));
});
