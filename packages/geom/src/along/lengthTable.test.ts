import { describe, expect, it } from 'vitest';
import { extractPolylines } from '../tessellate/polyline';
import { polygonFromPoints, rectPath } from '../paths/builder';
import { resolveCornersWithSources } from '../paths/corners';
import { pathFromD } from '../paths/pathFromD';
import type { CornerSpec } from '../paths/cornerSpec';
import {
  anchorAtLength, lengthAtAnchor, lengthAtSegmentFraction, lengthAtSubpath, lengthTable, type LengthRun,
} from './lengthTable';
import { pointAtLength } from './positions';
import { pathLengthTable } from './pathTable';

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

  it('measures a segment with a non-finite point as no distance, straight or curved', () => {
    const straight = lengthTable([anchored([0, 0, NaN, 0, 3, 0, 3, 4], false, 0)], 2);
    expect(straight.total).toBe(4);
    const curved = lengthTable([{ points: [0, 0, 3, 0, 3, 4], closed: false, controls: [[NaN, 0], null] }], 2);
    expect(curved.total).toBe(4);
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

  it('puts a closed rounded square in authored numbering', () => {
    const round: CornerSpec = { shape: 'round', radius: 20 };
    const square = { ...polygonFromPoints([{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }]), corners: [round, round, round, round] };
    const { path, anchorSources } = resolveCornersWithSources(square);
    expect(anchorSources).not.toBeNull();
    const t = lengthTable(extractPolylines(path), 2, anchorSources);
    // The run starts where corner 0's arc ends, so each side is a straight 160 then an arc; coords are float32.
    const arc = t.total / 4 - 160;
    expect(arc).toBeGreaterThan(28.5);
    expect(lengthAtAnchor(t, 0)).toBe(0);
    expect(lengthAtAnchor(t, 1)).toBeCloseTo(160 + arc / 2, 4);
    expect(lengthAtAnchor(t, 2)).toBeCloseTo(320 + arc * 1.5, 4);
    expect(lengthAtAnchor(t, 4)).toBe(t.total);
    expect(t.segments).toBe(4);
  });

  it('counts a closing edge dropped as a duplicate, straight or curved', () => {
    const straight = lengthTable(extractPolylines(pathFromD('M0,0 L1,0 L1,1 L0,1 L0,0 Z')), 2);
    const curved = lengthTable(extractPolylines(pathFromD('M0,0 L1,0 L1,1 L0,1 C0,0.66 0,0.33 0,0 Z')), 2);
    expect(straight.segments).toBe(5);
    expect(curved.segments).toBe(5);
    expect(lengthAtAnchor(straight, 4)).toBe(4);
    expect(lengthAtAnchor(straight, 4.5)).toBe(4);
    expect(lengthAtSegmentFraction(straight, 0.8)).toBe(4);
  });

  it('a spread copy keeps authored numbering', () => {
    const run = anchored([0, 0, 2, 0, 3, 1, 3, 4], false, 0);
    const t = lengthTable([run], 2, Uint32Array.from([0, 1, 1, 2]));
    const copy = { ...t };
    expect(lengthAtAnchor(copy, 1)).toBe(lengthAtAnchor(t, 1));
    expect(pointAtLength(copy, 1).point).toEqual([1, 0, 0]);
  });

  it('refuses a table built by hand', () => {
    const t = openL();
    const hand = { dim: t.dim, runs: t.runs, total: t.total, runStart: t.runStart, segments: t.segments };
    expect(() => lengthAtAnchor(hand, 1)).toThrow(/lengthTable/);
  });

  it('anchorAtLength inverts lengthAtAnchor', () => {
    const t = lengthTable([anchored([0, 0, 3, 0, 3, 4], false, 0), anchored([10, 0, 10, 2], false, 3)], 2);
    for (const a of [0, 0.5, 1, 1.25, 3, 3.5, 4]) expect(anchorAtLength(t, lengthAtAnchor(t, a))).toBeCloseTo(a, 12);
    expect(anchorAtLength(t, -1)).toBe(0);
    expect(anchorAtLength(t, 99)).toBe(4);
    expect(anchorAtLength(t, NaN)).toBeNaN();
  });

  it('gives a curve with a retracted handle the direction it leaves and arrives in, not its chord', () => {
    const r = Math.SQRT1_2;
    const out = pathLengthTable(pathFromD('M0,0 C0,0 10,10 20,0'));
    const start = pointAtLength(out, 0).tangent;
    expect(start[0]).toBeCloseTo(r, 12);
    expect(start[1]).toBeCloseTo(r, 12);
    const back = pathLengthTable(pathFromD('M20,0 C10,10 0,0 0,0'));
    const end = pointAtLength(back, back.total).tangent;
    expect(end[0]).toBeCloseTo(-r, 5);
    expect(end[1]).toBeCloseTo(-r, 5);
  });
});

