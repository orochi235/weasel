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
});
