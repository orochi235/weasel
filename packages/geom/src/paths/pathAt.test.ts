import { describe, it, expect } from 'vitest';
import { polylineFromPoints } from './builder';
import { pathFromD } from './pathFromD';
import { pointAlongPath } from './pathAt';

/** An L: 100 across, then 100 down. Total length 200. */
const elbow = polylineFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]);

describe('pointAlongPath', () => {
  it('measures by length across segments, not by segment count', () => {
    // Halfway along 200 units is the corner, not the middle of a segment.
    expect(pointAlongPath(elbow, 0.5)?.point).toEqual({ x: 100, y: 0 });
    expect(pointAlongPath(elbow, 0.25)?.point).toEqual({ x: 50, y: 0 });
    expect(pointAlongPath(elbow, 0.75)?.point).toEqual({ x: 100, y: 50 });
  });

  it('lands on the ends at 0 and 1', () => {
    expect(pointAlongPath(elbow, 0)?.point).toEqual({ x: 0, y: 0 });
    expect(pointAlongPath(elbow, 1)?.point).toEqual({ x: 100, y: 100 });
  });

  it('heads the way the path is going', () => {
    expect(pointAlongPath(elbow, 0.25)?.tangent).toEqual({ x: 1, y: 0 });
    expect(pointAlongPath(elbow, 0.75)?.tangent).toEqual({ x: 0, y: 1 });
  });

  it('clamps rather than extrapolating', () => {
    expect(pointAlongPath(elbow, -3)?.point).toEqual({ x: 0, y: 0 });
    expect(pointAlongPath(elbow, 3)?.point).toEqual({ x: 100, y: 100 });
  });

  it('measures a curve along its arc, not its parameter', () => {
    // A quarter circle of radius 100: the midpoint by arc length sits at 45°.
    const arc = pathFromD('M 100 0 A 100 100 0 0 1 0 100');
    const mid = pointAlongPath(arc, 0.5)!;
    expect(mid.point.x).toBeCloseTo(70.7, 0);
    expect(mid.point.y).toBeCloseTo(70.7, 0);
  });

  it('answers at the single point of a zero-length path', () => {
    const dot = polylineFromPoints([{ x: 7, y: 9 }, { x: 7, y: 9 }]);
    expect(pointAlongPath(dot, 0.5)).toEqual({
      point: { x: 7, y: 9 },
      tangent: { x: 1, y: 0 },
    });
  });

  it('is null for a path with no points', () => {
    const empty = {
      kind: 'polygon', commands: new Uint8Array(), coords: new Float32Array(),
      fillRule: 'nonzero',
    } as const;
    expect(pointAlongPath(empty, 0.5)).toBeNull();
  });
});
