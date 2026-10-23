import { describe, expect, test } from 'vitest';
import { arcShape } from './arc';
import { ellipseShape } from './ellipse';
import { lineShape } from './shape';
import { bendSide, shiftTrack } from './shift';

const center = { x: 100, y: 100 };
const top = arcShape({ center, radius: 80, start: 270, end: 90 });
const topCcw = arcShape({ center, radius: 80, start: 90, end: 270, direction: 'ccw' });
const bottom = arcShape({ center, radius: 80, start: 270, end: 90, direction: 'ccw' });
const dist = (p: { x: number; y: number }) => Math.hypot(p.x - center.x, p.y - center.y);

describe('bendSide', () => {
  test('an arc bends away from its normal, whichever way it runs and wherever it lies', () => {
    expect(bendSide(top)).toBe(-1);
    expect(bendSide(topCcw)).toBe(-1);
    expect(bendSide(bottom)).toBe(-1);
  });

  test('a line does not bend', () => {
    expect(bendSide(lineShape({ x: 0, y: 0 }, { x: 100, y: 0 }))).toBe(0);
  });
});

describe('shiftTrack', () => {
  test('an arc shifted against its normal is the concentric arc that much smaller', () => {
    const inner = shiftTrack(top, -30)!;
    expect(inner.length).toBeCloseTo(Math.PI * 50, 2);
    for (const f of [0, 0.25, 0.5, 0.9, 1]) {
      const s = inner.at(f);
      expect(dist(s.point)).toBeCloseTo(50, 6);
      // Arc length is even along it: a fraction f is f of the way round from 9 o'clock.
      const angle = Math.atan2(s.point.x - center.x, center.y - s.point.y);
      expect(angle).toBeCloseTo(-Math.PI / 2 + f * Math.PI, 3);
      expect(s.normal.x * top.at(f).normal.x + s.normal.y * top.at(f).normal.y).toBeCloseTo(1, 6);
    }
  });

  test('carries on past its ends when asked, as the arc it follows does', () => {
    const inner = shiftTrack(top, -30)!;
    expect(dist(inner.at(1.1, { open: true }).point)).toBeCloseTo(50, 3);
    expect(inner.at(1.1).point.x).toBeCloseTo(inner.at(1).point.x, 9);
  });

  test("nearest answers in the shifted track's own fractions", () => {
    const inner = shiftTrack(bottom, -30)!;
    const p = inner.at(0.3).point;
    // Out along the radius, so the nearest point is the same one.
    const n = inner.nearest({ x: center.x + (p.x - center.x) * 1.2, y: center.y + (p.y - center.y) * 1.2 });
    expect(n.f).toBeCloseTo(0.3, 6);
    expect(n.dist).toBeCloseTo(10, 6);
    expect(inner.nearest(p).dist).toBeCloseTo(0, 6);
  });

  test('a shift that reaches the center of curvature folds the track, and gives null', () => {
    expect(shiftTrack(top, -79)).not.toBeNull();
    expect(shiftTrack(top, -80)).toBeNull();
    expect(shiftTrack(top, -120)).toBeNull();
    // Outward never folds.
    expect(shiftTrack(top, 500)).not.toBeNull();
  });

  test('an ellipse folds once the shift passes its tightest bend, not its smaller radius', () => {
    const e = ellipseShape({ center, radiusX: 90, radiusY: 40, start: 270, end: 90 });
    // The tightest bend is at the ends of the long axis: 40² / 90 ≈ 17.8.
    expect(shiftTrack(e, -15)).not.toBeNull();
    expect(shiftTrack(e, -25)).toBeNull();
  });

  test('a shift of 0 is the shape itself', () => {
    expect(shiftTrack(top, 0)).toBe(top);
  });
});
