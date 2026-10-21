import { describe, expect, test } from 'vitest';
import type { Point } from '../paths/cubicMath';
import { arcShape } from './arc';

const close = (p: Point, q: Point) => {
  expect(p.x).toBeCloseTo(q.x);
  expect(p.y).toBeCloseTo(q.y);
};
const C = { x: 0, y: 0 };

describe('arcShape', () => {
  test("a clockwise quarter from 12 to 3 o'clock", () => {
    const a = arcShape({ center: C, radius: 100, start: 0, end: 90 });
    expect(a.length).toBeCloseTo(50 * Math.PI);
    close(a.at(0).point, { x: 0, y: -100 });
    close(a.at(0).tangent, { x: 1, y: 0 });
    close(a.at(0).normal, { x: 0, y: -1 });
    close(a.at(0.5).point, { x: 70.7107, y: -70.7107 });
    close(a.at(1).point, { x: 100, y: 0 });
    close(a.at(1).tangent, { x: 0, y: 1 });
  });
  test('counterclockwise runs the other way round, its normal still outward', () => {
    const a = arcShape({ center: C, radius: 100, start: 0, end: 270, direction: 'ccw' });
    expect(a.length).toBeCloseTo(50 * Math.PI);
    close(a.at(0).tangent, { x: -1, y: 0 });
    close(a.at(0).normal, { x: 0, y: -1 });
    close(a.at(1).point, { x: -100, y: 0 });
  });
  test("a sweep through 12 o'clock wraps", () => {
    const a = arcShape({ center: C, radius: 100, start: 300, end: 60 });
    expect(a.length).toBeCloseTo((100 * 2 * Math.PI) / 3);
    close(a.at(0.5).point, { x: 0, y: -100 });
  });
  test('equal start and end is a whole circle', () => {
    expect(arcShape({ center: C, radius: 10, start: 45, end: 45 }).length).toBeCloseTo(20 * Math.PI);
  });
  const bottom = arcShape({ center: C, radius: 100, start: 240, end: 120, direction: 'ccw' });
  test('nearest inside the sweep projects by angle', () => {
    const n = bottom.nearest({ x: 0, y: 150 });
    expect(n.f).toBeCloseTo(0.5);
    expect(n.dist).toBeCloseTo(50);
  });
  test('nearest past either end answers the nearer end, never the far one', () => {
    const at = (deg: number) => ({
      x: 100 * Math.sin((deg * Math.PI) / 180),
      y: -100 * Math.cos((deg * Math.PI) / 180),
    });
    expect(bottom.nearest(at(250)).f).toBe(0);
    expect(bottom.nearest(at(110)).f).toBe(1);
    expect(bottom.nearest(at(30)).f).toBe(1);
    expect(bottom.nearest(at(330)).f).toBe(0);
  });
  test("the center answers as 12 o'clock, never NaN", () => {
    expect(Number.isFinite(bottom.nearest(C).f)).toBe(true);
  });
});
