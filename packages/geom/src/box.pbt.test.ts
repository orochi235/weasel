import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  boundsOfCoords, boxContainsBox, boxContainsPoint, boxesIntersect, rectBetween, rectContainsPoint,
  rectsIntersect, rectsOverlap, unionBox, unionRects, type Rect,
} from './box';
import { closestPointOnSegment, distance, pointSegmentDist } from './points';
import { distance as distance2d, pointSegmentDist as segDist2d } from './points2';
import { box, coord, runs } from './pbt.fixture';

const RUNS = runs(300);
const rect: fc.Arbitrary<Rect> = fc.record({
  x: coord(), y: coord(), width: fc.double({ min: 0, max: 1000, noNaN: true }), height: fc.double({ min: 0, max: 1000, noNaN: true }),
});
const point = fc.tuple(coord(), coord());

describe('boxes, property', () => {
  it('a union holds both its inputs, in either order, and is associative', () => {
    fc.assert(fc.property(box, box, box, (a, b, c) => {
      const u = unionBox(a, b);
      expect(boxContainsBox(u, a)).toBe(true);
      expect(boxContainsBox(u, b)).toBe(true);
      expect(unionBox(b, a)).toEqual(u);
      expect(unionBox(unionBox(a, b), c)).toEqual(unionBox(a, unionBox(b, c)));
      expect(unionBox(a, a)).toEqual(a);
    }), RUNS);
  });

  it('two boxes intersect, either way round, exactly when some point lies in both', () => {
    fc.assert(fc.property(box, box, (a, b) => {
      const hit = boxesIntersect(a, b);
      expect(boxesIntersect(b, a)).toBe(hit);
      // The corner nearest both: in both boxes whenever any point is.
      const x = Math.max(a[0], b[0]), y = Math.max(a[1], b[1]);
      expect(boxContainsPoint(a, x, y) && boxContainsPoint(b, x, y)).toBe(hit);
    }), RUNS);
  });

  it('boundsOfCoords is the tightest box holding every point', () => {
    fc.assert(fc.property(fc.array(point, { minLength: 1, maxLength: 20 }), (pts) => {
      const b = boundsOfCoords(pts.flat())!;
      for (const [x, y] of pts) expect(boxContainsPoint(b, x, y)).toBe(true);
      expect(pts.some(([x]) => x === b[0]) && pts.some(([x]) => x === b[2])).toBe(true);
      expect(pts.some(([, y]) => y === b[1]) && pts.some(([, y]) => y === b[3])).toBe(true);
    }), RUNS);
  });
});

describe('rects, property', () => {
  it('intersect and overlap are symmetric, and overlap implies intersect', () => {
    fc.assert(fc.property(rect, rect, (a, b) => {
      expect(rectsIntersect(b, a)).toBe(rectsIntersect(a, b));
      expect(rectsOverlap(b, a)).toBe(rectsOverlap(a, b));
      if (rectsOverlap(a, b)) expect(rectsIntersect(a, b)).toBe(true);
    }), RUNS);
  });

  it('unionRects holds the corners of every rect', () => {
    fc.assert(fc.property(fc.array(rect, { minLength: 1, maxLength: 6 }), (rs) => {
      const u = unionRects(rs)!;
      const slack = 1e-9 * 2000;
      const grown = { x: u.x - slack, y: u.y - slack, width: u.width + 2 * slack, height: u.height + 2 * slack };
      for (const r of rs) {
        expect(rectContainsPoint(grown, r.x, r.y)).toBe(true);
        expect(rectContainsPoint(grown, r.x + r.width, r.y + r.height)).toBe(true);
      }
    }), RUNS);
  });

  it('rectBetween does not care which corner the drag started from', () => {
    fc.assert(fc.property(point, point, ([ax, ay], [bx, by]) => {
      expect(rectBetween(bx, by, ax, ay)).toEqual(rectBetween(ax, ay, bx, by));
      expect(rectBetween(ax, by, bx, ay)).toEqual(rectBetween(ax, ay, bx, by));
    }), RUNS);
  });
});

describe('distances, property', () => {
  const slack = (...ps: (readonly number[])[]): number => 1e-12 * (1 + ps.flat().reduce((s, v) => s + Math.abs(v), 0));

  it('obey the triangle inequality, in 2D and n-D', () => {
    const nd = fc.integer({ min: 1, max: 4 }).chain((n) => fc.tuple(...[0, 1, 2].map(() => fc.array(coord(), { minLength: n, maxLength: n }))));
    fc.assert(fc.property(nd, ([a, b, c]) => {
      expect(distance(a, c)).toBeLessThanOrEqual(distance(a, b) + distance(b, c) + slack(a, b, c));
      expect(distance(a, b)).toBe(distance(b, a));
    }), RUNS);
    fc.assert(fc.property(point, point, point, ([ax, ay], [bx, by], [cx, cy]) => {
      const a = { x: ax, y: ay }, b = { x: bx, y: by }, c = { x: cx, y: cy };
      expect(distance2d(a, c)).toBeLessThanOrEqual(distance2d(a, b) + distance2d(b, c) + slack([ax, ay, bx, by, cx, cy]));
    }), RUNS);
  });

  it('a point is no farther from a segment than from either end, and the nearest point is that far', () => {
    fc.assert(fc.property(point, point, point, (p, a, b) => {
      const d = pointSegmentDist(p, a, b);
      expect(d).toBeLessThanOrEqual(Math.min(distance(p, a), distance(p, b)) + slack(p, a, b));
      expect(Math.abs(distance(p, closestPointOnSegment(p, a, b)) - d)).toBeLessThanOrEqual(slack(p, a, b));
      expect(Math.abs(segDist2d(p[0], p[1], a[0], a[1], b[0], b[1]) - d)).toBeLessThanOrEqual(slack(p, a, b));
      expect(Math.abs(pointSegmentDist(p, b, a) - d)).toBeLessThanOrEqual(slack(p, a, b) * 1e3);
    }), RUNS);
  });
});
