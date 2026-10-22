import { describe, expect, test } from 'vitest';
import type { Point } from '../paths/cubicMath';
import { arcShape, type ArcTrackSpec } from './arc';
import { ellipseShape } from './ellipse';
import { trackShapeD } from './pathData';
import { trackRun } from './run';

const close = (p: Point, q: Point, digits = 6) => {
  expect(p.x).toBeCloseTo(q.x, digits);
  expect(p.y).toBeCloseTo(q.y, digits);
};
const C = { x: 0, y: 0 };
const RAD = Math.PI / 180;
/** The point on an `a` by `b` ellipse about C seen from it at `deg` clockwise from 12 o'clock. */
const seen = (deg: number, a: number, b: number): Point => {
  const s = Math.sin(deg * RAD);
  const c = Math.cos(deg * RAD);
  const k = 1 / Math.hypot(s / a, c / b);
  return { x: k * s, y: -k * c };
};

describe('ellipseShape', () => {
  test("a clockwise quarter from 12 to 3 o'clock runs from the top of the ellipse to its right", () => {
    const e = ellipseShape({ center: C, radiusX: 200, radiusY: 100, start: 0, end: 90 });
    close(e.at(0).point, { x: 0, y: -100 });
    close(e.at(0).tangent, { x: 1, y: 0 });
    close(e.at(0).normal, { x: 0, y: -1 });
    close(e.at(1).point, { x: 200, y: 0 });
    close(e.at(1).tangent, { x: 0, y: 1 });
    close(e.at(1).normal, { x: 1, y: 0 });
  });

  test("a whole ellipse's length is its perimeter", () => {
    // Ramanujan's second approximation, exact to well under a micron at this eccentricity.
    const a = 200;
    const b = 100;
    const h = ((a - b) / (a + b)) ** 2;
    const perimeter = Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
    expect(ellipseShape({ center: C, radiusX: a, radiusY: b, start: 0, end: 0 }).length).toBeCloseTo(perimeter, 4);
  });

  test('start and end are directions seen from the center, as an arc’s are', () => {
    const e = ellipseShape({ center: C, radiusX: 200, radiusY: 100, start: 45, end: 135 });
    close(e.at(0).point, seen(45, 200, 100));
    close(e.at(1).point, seen(135, 200, 100));
  });

  test('only a whole ellipse is closed', () => {
    expect(ellipseShape({ center: C, radiusX: 20, radiusY: 10, start: 30, end: 30 }).closed).toBe(true);
    expect(ellipseShape({ center: C, radiusX: 20, radiusY: 10, start: 0, end: 90 }).closed).toBe(false);
  });
  test('a fraction is a fraction of the length, not of the angle', () => {
    const e = ellipseShape({ center: C, radiusX: 300, radiusY: 60, start: 0, end: 90 });
    /** The length from `f` to `g`, walked in fine chords. */
    const walked = (f: number, g: number) => {
      let sum = 0;
      for (let i = 0; i < 400; i++) {
        const p = e.at(f + ((g - f) * i) / 400).point;
        const q = e.at(f + ((g - f) * (i + 1)) / 400).point;
        sum += Math.hypot(p.x - q.x, p.y - q.y);
      }
      return sum;
    };
    // The ellipse bends far more near the end of its long axis, so equal angles there are far shorter.
    expect(walked(0, 0.1)).toBeCloseTo(e.length / 10, 2);
    expect(walked(0.9, 1)).toBeCloseTo(e.length / 10, 2);
  });

  test('the normal is square to the tangent and points away from the center', () => {
    const e = ellipseShape({ center: { x: 10, y: 20 }, radiusX: 150, radiusY: 90, start: 200, end: 30 });
    for (const f of [0, 0.2, 0.5, 0.8, 1]) {
      const { point, tangent, normal } = e.at(f);
      expect(tangent.x * normal.x + tangent.y * normal.y).toBeCloseTo(0, 9);
      expect(Math.hypot(normal.x, normal.y)).toBeCloseTo(1, 9);
      expect((point.x - 10) * normal.x + (point.y - 20) * normal.y).toBeGreaterThan(0);
    }
  });

  test('counterclockwise runs the other way round, its normal still outward', () => {
    const e = ellipseShape({ center: C, radiusX: 200, radiusY: 100, start: 0, end: 270, direction: 'ccw' });
    close(e.at(0).tangent, { x: -1, y: 0 });
    close(e.at(0).normal, { x: 0, y: -1 });
    close(e.at(1).point, { x: -200, y: 0 });
  });

  const bottom = ellipseShape({ center: C, radiusX: 120, radiusY: 80, start: 240, end: 120, direction: 'ccw' });

  test('nearest finds the foot of the perpendicular', () => {
    for (const f of [0.1, 0.35, 0.5, 0.8]) {
      const { point, normal } = bottom.at(f);
      const p = { x: point.x + 25 * normal.x, y: point.y + 25 * normal.y };
      const n = bottom.nearest(p);
      expect(n.f).toBeCloseTo(f, 6);
      expect(n.dist).toBeCloseTo(25, 6);
    }
  });

  test('nearest past either end answers the nearer end', () => {
    expect(bottom.nearest(seen(250, 120, 80)).f).toBe(0);
    expect(bottom.nearest(seen(110, 120, 80)).f).toBe(1);
    expect(bottom.nearest(seen(30, 120, 80)).f).toBe(1);
    expect(bottom.nearest(seen(330, 120, 80)).f).toBe(0);
  });

  test('open, nearest runs on past the ends by length, and back within them agrees with the closed answer', () => {
    const inside = bottom.nearest(seen(180, 120, 80), { open: true });
    expect(inside.f).toBeCloseTo(0.5, 6);
    const past = bottom.nearest(seen(100, 120, 80), { open: true });
    expect(past.f).toBeGreaterThan(1);
    expect(past.dist).toBeCloseTo(bottom.nearest(seen(100, 120, 80)).dist, 9);
    expect(bottom.nearest(seen(260, 120, 80), { open: true }).f).toBeLessThan(0);
  });

  test("the center answers finitely, never NaN", () => {
    const n = bottom.nearest(C, { open: true });
    expect(Number.isFinite(n.f)).toBe(true);
    expect(Number.isFinite(n.dist)).toBe(true);
  });

  test('a zero-size ellipse answers its center, never NaN', () => {
    const dot = ellipseShape({ center: { x: 5, y: 5 }, radiusX: 0, radiusY: 0, start: 240, end: 120 });
    expect(dot.length).toBe(0);
    const s = dot.at(0.5);
    for (const v of [s.point.x, s.point.y, s.tangent.x, s.tangent.y, s.normal.x, s.normal.y]) expect(Number.isFinite(v)).toBe(true);
    expect(Number.isFinite(dot.nearest({ x: 9, y: 9 }).f)).toBe(true);
  });

  test('a run along the bottom turns its items upright and reads left to right', () => {
    const run = trackRun(bottom);
    expect(run.flipped).toBe(true);
    expect(run.at(0).point.x).toBeLessThan(run.at(1).point.x);
  });
});

describe('ellipseShape with equal radii', () => {
  const specs: ArcTrackSpec[] = [
    { center: { x: 30, y: -10 }, radius: 70, start: 0, end: 90 },
    { center: C, radius: 64, start: 240, end: 120, direction: 'ccw' },
    { center: C, radius: 64, start: 300, end: 60 },
    { center: C, radius: 10, start: 45, end: 45 },
  ];
  const points: Point[] = [
    { x: 0, y: 90 },
    { x: 100, y: 5 },
    { x: -40, y: -60 },
    { x: 3, y: 2 },
  ];
  test.each(specs)('is the arc of that radius: %o', (spec) => {
    const { radius, ...rest } = spec;
    const e = ellipseShape({ ...rest, radiusX: radius, radiusY: radius });
    const a = arcShape(spec);
    expect(e.length).toBeCloseTo(a.length, 9);
    for (let i = 0; i <= 20; i++) {
      const f = i / 20;
      const se = e.at(f);
      const sa = a.at(f);
      close(se.point, sa.point, 9);
      close(se.tangent, sa.tangent, 9);
      close(se.normal, sa.normal, 9);
    }
    for (const p of points) {
      const ne = e.nearest(p);
      const na = a.nearest(p);
      expect(ne.f).toBeCloseTo(na.f, 9);
      expect(ne.dist).toBeCloseTo(na.dist, 9);
      for (const about of [0.5, 0.1]) {
        const oe = e.nearest(p, { open: true, about });
        const oa = a.nearest(p, { open: true, about });
        expect(oe.f).toBeCloseTo(oa.f, 9);
        expect(oe.dist).toBeCloseTo(oa.dist, 9);
      }
    }
    expect(trackShapeD(e)).toBe(trackShapeD(a));
    expect(trackShapeD(e, 0.25, 0.75)).toBe(trackShapeD(a, 0.25, 0.75));
  });
});

describe('trackShapeD on an ellipse', () => {
  test('draws true elliptical arcs, with both radii', () => {
    const e = ellipseShape({ center: C, radiusX: 200, radiusY: 100, start: 0, end: 90 });
    expect(trackShapeD(e)).toBe('M 0 -100 A 200 100 0 0 1 200 0');
  });
  test('sets the large-arc flag past half the ellipse', () => {
    const e = ellipseShape({ center: C, radiusX: 200, radiusY: 100, start: 0, end: 90, direction: 'ccw' });
    expect(trackShapeD(e)).toBe('M 0 -100 A 200 100 0 1 0 200 0');
  });
  test('a whole ellipse is two halves', () => {
    const e = ellipseShape({ center: C, radiusX: 20, radiusY: 10, start: 0, end: 0 });
    expect(trackShapeD(e)).toBe('M 0 -10 A 20 10 0 0 1 0 10 A 20 10 0 0 1 0 -10');
  });
});
