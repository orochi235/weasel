import { describe, expect, it } from 'vitest';
import { polylineFromPoints, rectPath } from './builder';
import { measurePath } from './pathMeasure';

const elbow = polylineFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]);

describe('measurePath', () => {
  it('measures every segment, and knows a single closed contour', () => {
    expect(measurePath(elbow)!.length).toBe(200);
    expect(measurePath(elbow)!.closed).toBe(false);
    expect(measurePath(rectPath(0, 0, 10, 10))!.closed).toBe(true);
  });

  it('blends the heading across a corner when smooth', () => {
    const m = measurePath(elbow)!;
    expect(m.at(50).tangent).toEqual({ x: 1, y: 0 });
    const t = m.at(99.999, true).tangent;
    expect(t.x).toBeCloseTo(Math.SQRT1_2, 3);
    expect(t.y).toBeCloseTo(Math.SQRT1_2, 3);
    // An open path's ends keep their own heading.
    expect(m.at(0, true).tangent).toEqual({ x: 1, y: 0 });
  });

  it('finds the arc length nearest a point, the inverse of at()', () => {
    const m = measurePath(elbow)!;
    expect(m.nearest({ x: 30, y: -12 })).toMatchObject({ s: 30, dist: 12, point: { x: 30, y: 0 }, tangent: { x: 1, y: 0 } });
    expect(m.nearest({ x: 140, y: 150 })).toMatchObject({ s: 200, point: { x: 100, y: 100 } });
    const back = m.nearest(m.at(137).point);
    expect(back.s).toBeCloseTo(137, 9);
  });

  it('answers a zero-length path at its point', () => {
    const m = measurePath(polylineFromPoints([{ x: 5, y: 5 }, { x: 5, y: 5 }]))!;
    expect(m.nearest({ x: 8, y: 9 })).toMatchObject({ s: 0, dist: 5, point: { x: 5, y: 5 } });
  });
});
