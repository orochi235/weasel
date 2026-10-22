import { describe, expect, test } from 'vitest';
import { ellipsePath } from '../paths/builder';
import type { Point } from '../paths/cubicMath';
import { pathFromD } from '../paths/pathFromD';
import { pathToD } from '../paths/pathToD';
import { pathShape } from './path';
import { trackShapeD } from './pathData';

const close = (p: Point, q: Point) => {
  expect(p.x).toBeCloseTo(q.x);
  expect(p.y).toBeCloseTo(q.y);
};
const finite = (p: Point) => Number.isFinite(p.x) && Number.isFinite(p.y);

describe('pathShape', () => {
  test('a straight path is the line track', () => {
    const s = pathShape(pathFromD('M0 0 L100 0'))!;
    expect(s.kind).toBe('path');
    expect(s.length).toBe(100);
    expect(s.closed).toBe(false);
    const st = s.at(0.25);
    close(st.point, { x: 25, y: 0 });
    close(st.tangent, { x: 1, y: 0 });
    close(st.normal, { x: 0, y: -1 });
    const n = s.nearest({ x: 30, y: 40 });
    expect(n.f).toBeCloseTo(0.3);
    expect(n.dist).toBeCloseTo(40);
  });
  test("a closed contour knows it is closed and unwraps nearest about 'about'", () => {
    const s = pathShape(pathFromD('M0 0 H100 V100 H0 Z'))!;
    expect(s.closed).toBe(true);
    expect(s.length).toBe(400);
    expect(s.nearest({ x: -1, y: 10 }, { open: true, about: 0.05 }).f).toBeCloseTo(-0.025);
    expect(s.nearest({ x: -1, y: 10 }).f).toBeCloseTo(0.975);
  });
  test('open nearest on an open path clamps', () => {
    const s = pathShape(pathFromD('M0 0 L100 0'))!;
    expect(s.nearest({ x: 150, y: 0 }, { open: true }).f).toBe(1);
  });
  test("a circle path's normal points outward when drawn clockwise on screen", () => {
    const center = { x: 50, y: 50 };
    for (const path of [
      ellipsePath({ x: 0, y: 0, width: 100, height: 100 }),
      pathFromD('M50 0 A50 50 0 0 1 50 100 A50 50 0 0 1 50 0 Z'),
    ]) {
      const s = pathShape(path)!;
      for (const f of [0.1, 0.4, 0.8]) {
        const { point, normal } = s.at(f);
        expect(normal.x * (point.x - center.x) + normal.y * (point.y - center.y)).toBeGreaterThan(0);
      }
    }
  });
  test("a polygon's straight edge heads along itself; only its corners turn", () => {
    for (const path of [pathFromD('M0 0 H360 V200 H0 Z'), { kind: 'rect', x: 0, y: 0, width: 360, height: 200 } as const]) {
      const s = pathShape(path)!;
      for (const x of [20, 100, 180, 260, 340]) close(s.at(x / s.length).tangent, { x: 1, y: 0 });
      close(s.at(460 / s.length).tangent, { x: 0, y: 1 });
    }
  });
  test('a curve still turns smoothly between its flattened vertices', () => {
    const s = pathShape(ellipsePath({ x: 0, y: 0, width: 200, height: 200 }))!;
    for (const f of [0.1, 0.33, 0.6, 0.85]) {
      const { point, tangent } = s.at(f);
      // On a circle the heading is square to the radius.
      expect(Math.abs(tangent.x * (point.x - 100) + tangent.y * (point.y - 100)) / 100).toBeLessThan(0.01);
    }
  });
  test('a compound path runs on across its subpaths', () => {
    const s = pathShape(pathFromD('M0 0 L10 0 M20 0 L30 0'))!;
    expect(s.length).toBe(20);
    expect(s.closed).toBe(false);
    for (let i = 0; i <= 20; i++) {
      const st = s.at(i / 20);
      expect(finite(st.point) && finite(st.tangent) && finite(st.normal)).toBe(true);
    }
  });
  test('no points is null; one point is a zero-length shape that answers finitely', () => {
    expect(pathShape(pathFromD(''))).toBeNull();
    const dot = pathShape(pathFromD('M5 5'))!;
    expect(dot.length).toBe(0);
    const st = dot.at(0.5);
    expect(finite(st.point) && finite(st.tangent) && finite(st.normal)).toBe(true);
    expect(dot.nearest({ x: 9, y: 8 }).f).toBe(0);
    expect(dot.nearest({ x: 9, y: 8 }, { open: true }).f).toBe(0);
  });
  test('the shape keeps its path, out of sight of a spread', () => {
    const path = pathFromD('M0 0 L100 0');
    const s = pathShape(path)!;
    expect(s.path).toBe(path);
    expect(Object.keys(s)).not.toContain('path');
  });
});

describe('trackShapeD on a path shape', () => {
  const path = pathFromD('M0 0 C 30 -40 70 -40 100 0');
  test("a whole path shape is the path's own data", () => {
    expect(trackShapeD(pathShape(path)!)).toBe(pathToD(path));
  });
  test('a stretch of it is the 64-step polyline', () => {
    const d = trackShapeD(pathShape(path)!, 0.25, 0.75);
    expect(d.startsWith('M ')).toBe(true);
    expect(d.split(' L ').length).toBe(65);
  });
});
