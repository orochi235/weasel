import { describe, expect, it } from 'vitest';
import { cubicEvalAt } from '../curve';
import { pathFromD } from '../paths/pathFromD';
import { segmentLength, segmentTAtLength } from '../paths/segmentLength';
import { extractPolylines } from '../tessellate/polyline';
import { polylineAtCurve } from '../tessellate/atCurve';
import type { PolygonPath } from '../path';
import { curveSpan, lengthAtCurve } from './curvePosition';
import { lengthAtAnchor } from './lengthTable';
import { pathLengthTable } from './pathTable';
import { pointAtLength } from './positions';

const C = [0, 0, 20, 90, 120, -60, 200, 40];
const CUBIC = pathFromD(`M0 0 C20 90 120 -60 200 40 L260 40`);
const exactAt = (s: number) => cubicEvalAt(C[0], C[1], C[2], C[3], C[4], C[5], C[6], C[7], segmentTAtLength(C, 2, s));

describe('pathLengthTable', () => {
  it('measures curves by exact arc length', () => {
    const t = pathLengthTable(CUBIC);
    expect(t.total).toBeCloseTo(segmentLength(C, 2) + 60, 9);
    expect(lengthAtAnchor(t, 1)).toBeCloseTo(segmentLength(C, 2), 9);
    expect(pathLengthTable(CUBIC)).toBe(t);
  });

  it('answers the exact point at a length', () => {
    const { point } = pointAtLength(pathLengthTable(CUBIC), 90);
    const [x, y] = exactAt(90);
    // Each solve stops within 1e-10 of the segment's length, so two of them agree to about 1e-8.
    expect(point[0]).toBeCloseTo(x, 6);
    expect(point[1]).toBeCloseTo(y, 6);
  });

  it('measures a closed subpath drawn as one curve', () => {
    const drop = pathFromD('M0 0 C100 -50 100 50 0 0 Z');
    const t = pathLengthTable(drop);
    expect(t.total).toBeCloseTo(segmentLength([0, 0, 100, -50, 100, 50, 0, 0], 2), 9);
    expect(t.segments).toBeGreaterThan(0);
  });
});

describe('curve positions', () => {
  it('round-trip a length', () => {
    const t = pathLengthTable(CUBIC);
    const to = segmentLength(C, 2) + 30;
    const span = curveSpan(t, { from: 30, to })!;
    expect(span.from.segment).toBe(0);
    expect(span.to).toEqual({ run: 0, segment: 1, t: 0.5 });
    expect(lengthAtCurve(t, span.from)).toBeCloseTo(30, 9);
    expect(lengthAtCurve(t, span.to)).toBeCloseTo(to, 9);
  });

  it('end on the earlier run and start on the later where runs meet', () => {
    const two = pathFromD('M0 0 L10 0 M0 5 L10 5');
    const t = pathLengthTable(two);
    expect(curveSpan(t, { from: 0, to: 10 })!.to).toEqual({ run: 0, segment: 0, t: 1 });
    expect(curveSpan(t, { from: 10, to: 20 })!.from).toEqual({ run: 1, segment: 0, t: 0 });
    expect(curveSpan(t, { from: 5, to: 5 })).toBeNull();
  });

  it('land on the exact point of every flattening', () => {
    const t = pathLengthTable(CUBIC);
    const { from } = curveSpan(t, { from: 137, to: 200 })!;
    const [x, y] = exactAt(137);
    for (const tol of [4, 0.5, 0.001]) {
      const [pl] = extractPolylines(CUBIC as PolygonPath, { flattenTolerance: tol });
      const place = polylineAtCurve(pl, from.segment, from.t, t.runs[0]);
      expect(Math.hypot(place.x - x, place.y - y)).toBeLessThan(1e-9);
      // The polyline's own length there, which a dash phase reads.
      expect(place.length).toBeGreaterThan(130);
      expect(place.length).toBeLessThan(137 + 1e-9);
    }
  });
});
