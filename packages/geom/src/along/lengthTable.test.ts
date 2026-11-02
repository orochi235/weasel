import { describe, expect, it } from 'vitest';
import { extractPolylines } from '../tessellate/polyline';
import { rectPath } from '../paths/builder';
import {
  lengthAtAnchor, lengthAtSegmentFraction, lengthAtSubpath, lengthTable, type LengthRun,
} from './lengthTable';
import { pointAtLength } from './positions';

/** A run whose every point is an anchor, numbered from `first`. */
function anchored(points: number[], closed: boolean, first: number, dim = 2): LengthRun {
  const n = points.length / dim;
  const ids = Array.from({ length: n }, (_v, i) => first + i);
  return { points, closed, anchorA: ids, anchorB: ids, anchorT: new Array<number>(n).fill(0) };
}

const openL = () => lengthTable([anchored([0, 0, 3, 0, 3, 4], false, 0)], 2);

describe('lengthTable', () => {
  it('measures an open L', () => {
    const t = openL();
    expect(t.total).toBe(7);
    expect(lengthAtAnchor(t, 1)).toBe(3);
    expect(lengthAtAnchor(t, 1.5)).toBe(5);
    expect(t.segments).toBe(2);
  });

  it("counts a closed run's closing edge", () => {
    const t = lengthTable([anchored([0, 0, 1, 0, 1, 1, 0, 1], true, 0)], 2);
    expect(t.total).toBe(4);
    expect(t.segments).toBe(4);
    expect(lengthAtAnchor(t, 3.5)).toBe(3.5);
  });

  it('pen lift covers no distance', () => {
    const t = lengthTable([anchored([0, 0, 1, 0], false, 0), anchored([5, 0, 6, 0], false, 2)], 2);
    expect(t.total).toBe(2);
    expect(Array.from(t.runStart)).toEqual([0, 1, 2]);
    expect(lengthAtAnchor(t, 1.5)).toBe(1);
    expect(lengthAtSubpath(t, 1)).toBe(1);
    expect(lengthAtSubpath(t, 1.5)).toBe(1.5);
    expect(t.segments).toBe(2);
  });

  it('maps corner-expanded anchors to authored numbering', () => {
    // The corner at authored anchor 1 cut into expanded anchors 1 and 2, its arc stood in for by a chord.
    const run = anchored([0, 0, 2, 0, 3, 1, 3, 4], false, 0);
    const t = lengthTable([run], 2, Uint32Array.from([0, 1, 1, 2]));
    const arcStart = 2;
    const arcEnd = 2 + Math.SQRT2;
    expect(lengthAtAnchor(t, 1)).toBeCloseTo((arcStart + arcEnd) / 2, 12);
    expect(lengthAtAnchor(t, 2)).toBeCloseTo(t.total, 12);
    expect(t.segments).toBe(2);
  });

  it('reads a flattened closed rect', () => {
    const t = lengthTable(extractPolylines(rectPath(0, 0, 2, 1)), 2);
    expect(t.total).toBe(6);
    expect(t.segments).toBe(4);
    expect(lengthAtAnchor(t, 4)).toBe(6);
  });

  it('pointAtLength gives point and unit tangent', () => {
    const { point, tangent } = pointAtLength(openL(), 5);
    expect(point).toEqual([3, 2, 0]);
    expect(tangent).toEqual([0, 1, 0]);
  });

  it('works in 3 components', () => {
    const t = lengthTable([{ points: [0, 0, 0, 0, 0, 2], closed: false }], 3);
    expect(t.total).toBe(2);
    expect(pointAtLength(t, 1)).toEqual({ point: [0, 0, 1], tangent: [0, 0, 1] });
  });

  it('lengthAtSegmentFraction is equal time per segment', () => {
    const t = openL();
    expect(lengthAtSegmentFraction(t, 0.5)).toBe(3);
    expect(lengthAtSegmentFraction(t, 0.75)).toBe(5);
  });

  it('skips a pen lift under segment pace', () => {
    const t = lengthTable([anchored([0, 0, 1, 0], false, 0), anchored([5, 0, 7, 0], false, 2)], 2);
    expect(lengthAtSegmentFraction(t, 0.75)).toBe(2);
  });

  it('clamps queries to the path', () => {
    const t = openL();
    expect(lengthAtAnchor(t, -3)).toBe(0);
    expect(lengthAtAnchor(t, 40)).toBe(7);
    expect(lengthAtSubpath(t, 9)).toBe(7);
    expect(pointAtLength(t, 99).point).toEqual([3, 4, 0]);
  });
});
