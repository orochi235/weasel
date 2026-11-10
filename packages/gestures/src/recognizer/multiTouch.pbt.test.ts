/**
 * Property tests of the geometry a multitouch gesture reports and of the drag threshold: their ranges, and how
 * each moves when every point is translated, rotated a quarter turn, or the first two fingers swap.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs } from '../pbt.fixture';
import { pastDragThreshold } from '../ui/dragThreshold';
import { multiTouchGeometry, type Point } from './multiTouch';

const RUNS = 500;

const real = fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true });
const point: fc.Arbitrary<Point> = fc.record({ x: real, y: real });
const hand = fc.array(point, { minLength: 2, maxLength: 5 });
const whole = fc.integer({ min: -5000, max: 5000 });
const wholePoint: fc.Arbitrary<Point> = fc.record({ x: whole, y: whole });

/** The signed difference `a - b` between two angles in degrees, in [-180, 180). */
const turn = (a: number, b: number): number => ((((a - b) % 360) + 540) % 360) - 180;

describe('multiTouchGeometry', () => {
  it('reports a finite spread of at least 0 and an angle in (-180, 180]', () => {
    fc.assert(fc.property(hand, (pts) => {
      const g = multiTouchGeometry(pts);
      expect(Number.isFinite(g.spread) && g.spread >= 0).toBe(true);
      expect(g.angle > -180 && g.angle <= 180, `angle ${g.angle}`).toBe(true);
      expect(Number.isFinite(g.centroid.x) && Number.isFinite(g.centroid.y)).toBe(true);
    }), runs(RUNS));
  });

  it('moves the centroid with a translation and keeps the spread and the angle', () => {
    fc.assert(fc.property(fc.array(wholePoint, { minLength: 2, maxLength: 5 }), whole, whole, (pts, dx, dy) => {
      const a = multiTouchGeometry(pts);
      const b = multiTouchGeometry(pts.map((p) => ({ x: p.x + dx, y: p.y + dy })));
      expect(b.spread).toBe(a.spread);
      expect(b.angle).toBe(a.angle);
      expect(b.centroid.x).toBeCloseTo(a.centroid.x + dx, 6);
      expect(b.centroid.y).toBeCloseTo(a.centroid.y + dy, 6);
    }), runs(RUNS));
  });

  it('turns the angle a quarter clockwise with the hand, and half round when the first two swap', () => {
    fc.assert(fc.property(fc.array(wholePoint, { minLength: 2, maxLength: 5 }), (pts) => {
      const a = multiTouchGeometry(pts);
      fc.pre(a.spread > 0);
      const quarter = multiTouchGeometry(pts.map((p) => ({ x: -p.y, y: p.x })));
      expect(Math.abs(turn(quarter.angle, a.angle + 90))).toBeLessThan(1e-9);
      expect(quarter.spread).toBeCloseTo(a.spread, 9);
      const swapped = multiTouchGeometry([pts[1]!, pts[0]!, ...pts.slice(2)]);
      expect(Math.abs(turn(swapped.angle, a.angle + 180))).toBeLessThan(1e-9);
      expect(swapped.spread).toBe(a.spread);
    }), runs(RUNS));
  });

  it('reports zeros for fewer than two points', () => {
    fc.assert(fc.property(fc.array(point, { maxLength: 1 }), (pts) => {
      expect(multiTouchGeometry(pts)).toEqual({ centroid: { x: 0, y: 0 }, spread: 0, angle: 0 });
    }), runs(50));
  });
});

describe('pastDragThreshold', () => {
  const at = (p: Point) => ({ clientX: p.x, clientY: p.y });
  const threshold = fc.integer({ min: 0, max: 20 });

  it('is symmetric, unmoved by a translation, and crossed once the travel reaches the threshold', () => {
    fc.assert(fc.property(wholePoint, wholePoint, whole, whole, threshold, (a, b, dx, dy, t) => {
      const past = pastDragThreshold(at(a), at(b), t);
      expect(pastDragThreshold(at(b), at(a), t)).toBe(past);
      expect(pastDragThreshold(at({ x: a.x + dx, y: a.y + dy }), at({ x: b.x + dx, y: b.y + dy }), t)).toBe(past);
      expect(past).toBe(Math.hypot(b.x - a.x, b.y - a.y) >= t);
      if (past) expect(pastDragThreshold(at(a), at(b), Math.max(0, t - 1))).toBe(true);
    }), runs(RUNS));
  });

  it('is crossed by any travel at a threshold of 0, and never by standing still above it', () => {
    fc.assert(fc.property(wholePoint, threshold, (a, t) => {
      expect(pastDragThreshold(at(a), at(a), 0)).toBe(true);
      if (t > 0) expect(pastDragThreshold(at(a), at(a), t)).toBe(false);
    }), runs(RUNS));
  });
});
