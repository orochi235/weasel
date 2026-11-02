import { describe, expect, it } from 'vitest';
import {
  type PolygonPath, lengthAtAnchor, polygonFromPoints, polylineFromPoints, resolveCornersWithSources,
} from '@weasel-js/geom';
import { type Polyline, extractPolylines } from '@weasel-js/geom/tessellate';
import { polylineTable, windowPolylines } from './windowPolylines';

function anchored(points: number[], closed: boolean, first = 0): Polyline {
  const n = points.length / 2;
  const ids = Uint32Array.from({ length: n }, (_v, i) => first + i);
  return { points, closed, anchorA: ids, anchorB: ids.slice(), anchorT: new Float32Array(n) };
}

const openL = () => anchored([0, 0, 3, 0, 3, 4], false);
const square = () => anchored([0, 0, 1, 0, 1, 1, 0, 1], true);
const last = (pl: Polyline) => pl.points.slice(-2);

describe('windowPolylines', () => {
  it('no trim returns null', () => {
    expect(windowPolylines([openL()], undefined)).toBeNull();
  });

  it('cuts an open run at both ends', () => {
    const runs = windowPolylines([openL()], { start: 0.25, end: 0.75 })!;
    expect(runs).toHaveLength(1);
    const [{ polyline, fromClosed, dashPhase }] = runs;
    expect(polyline.points.slice(0, 2)).toEqual([1.75, 0]);
    expect(last(polyline)[0]).toBe(3);
    expect(last(polyline)[1]).toBeCloseTo(2.25, 12);
    expect(polyline.closed).toBe(false);
    expect(fromClosed).toBe(false);
    expect(dashPhase).toBe(1.75);
  });

  it('cuts a closed run open', () => {
    const runs = windowPolylines([square()], { end: 0.5 })!;
    expect(runs).toHaveLength(1);
    const [{ polyline, fromClosed, dashPhase }] = runs;
    expect(polyline.points).toEqual([0, 0, 1, 0, 1, 1]);
    expect(polyline.closed).toBe(false);
    expect(fromClosed).toBe(true);
    expect(dashPhase).toBe(0);
  });

  it('opens a closed run through its closing edge', () => {
    const [{ polyline, dashPhase }] = windowPolylines([square()], { start: 0.5, end: 0.875 })!;
    expect(polyline.points).toEqual([1, 1, 0, 1, 0, 0.5]);
    expect(dashPhase).toBe(2);
  });

  it('ends an opened closed run at the anchor its closing edge reaches', () => {
    const [{ polyline }] = windowPolylines([square()], { start: 0.5 })!;
    expect(polyline.points).toEqual([1, 1, 0, 1, 0, 0]);
    expect(Array.from(polyline.anchorA!)).toEqual([2, 3, 0]);
    expect(Array.from(polyline.anchorB!)).toEqual([2, 3, 0]);
    const dropped: Polyline = { ...anchored([0, 0, 1, 0, 1, 1, 0, 1], true), closeAnchor: 4 };
    const [{ polyline: d }] = windowPolylines([dropped], { start: 0.5 })!;
    expect(d.anchorA![2]).toBe(4);
  });

  it('keeps a closed run that the window covers whole', () => {
    const [{ polyline, fromClosed, dashPhase }] = windowPolylines([square()], {})!;
    expect(polyline.closed).toBe(true);
    expect(polyline.points).toEqual([0, 0, 1, 0, 1, 1, 0, 1]);
    expect(fromClosed).toBe(true);
    expect(dashPhase).toBe(0);
  });

  it('a window ending at a subpath start draws nothing of it', () => {
    const runs = windowPolylines([openL(), anchored([10, 0, 12, 0], false, 3)], { end: { subpath: 1 } })!;
    expect(runs).toHaveLength(1);
    expect(runs[0].polyline.points).toEqual([0, 0, 3, 0, 3, 4]);
  });

  it('a window starting at a subpath end draws nothing of it', () => {
    const runs = windowPolylines([openL(), anchored([10, 0, 12, 0], false, 3)], { start: { subpath: 1 } })!;
    expect(runs).toHaveLength(1);
    expect(runs[0].polyline.points).toEqual([10, 0, 12, 0]);
    expect(runs[0].dashPhase).toBe(0);
  });

  it('an empty window draws nothing', () => {
    expect(windowPolylines([openL()], { start: 0.6, end: 0.4 })).toEqual([]);
  });

  it('windows a cornered path in authored numbering', () => {
    const authored = {
      ...polylineFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]),
      corners: [null, { shape: 'round', radius: 20 }, null],
    } as PolygonPath;
    const { path, anchorSources } = resolveCornersWithSources(authored);
    const polylines = extractPolylines(path);
    const table = polylineTable(polylines, anchorSources);
    const [{ polyline }] = windowPolylines(polylines, { end: { anchor: 1 } }, anchorSources)!;
    const [x, y] = last(polyline);
    // The arc's midpoint: center (80, 20), radius 20, at -45 degrees.
    expect(x).toBeCloseTo(80 + 20 * Math.SQRT1_2, 0);
    expect(y).toBeCloseTo(20 - 20 * Math.SQRT1_2, 0);
    expect(x + y).toBeCloseTo(100, 3);
    let len = 0;
    for (let i = 2; i < polyline.points.length; i += 2) {
      len += Math.hypot(polyline.points[i] - polyline.points[i - 2], polyline.points[i + 1] - polyline.points[i - 1]);
    }
    expect(len).toBeCloseTo(lengthAtAnchor(table, 1), 4);
  });

  it('keeps a whole closed run closed beside a cut open one', () => {
    expect(windowPolylines([square()], { end: 1 })![0].polyline.closed).toBe(true);
    const runs = windowPolylines([square(), anchored([10, 0, 12, 0], false, 4)], { end: 5 / 6 })!;
    expect(runs.map((r) => r.polyline.closed)).toEqual([true, false]);
    expect(runs[1].polyline.points).toEqual([10, 0, 11, 0]);
  });

  it('windows a rounded closed path through its closing edge', () => {
    const round = { shape: 'round', radius: 20 } as const;
    const authored = {
      ...polygonFromPoints([{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }]),
      corners: [round, round, round, round],
    };
    const { path, anchorSources } = resolveCornersWithSources(authored);
    const polylines = extractPolylines(path);
    const table = polylineTable(polylines, anchorSources);
    const [{ polyline, fromClosed, dashPhase }] = windowPolylines(polylines, { start: { anchor: 3 } }, anchorSources, table)!;
    expect(fromClosed).toBe(true);
    expect(dashPhase).toBeCloseTo(lengthAtAnchor(table, 3), 6);
    // Anchor 0 sits at corner 0's arc end, where the run began, so the window ends there, as authored anchor 0.
    expect(last(polyline)).toEqual(polylines[0].points.slice(0, 2));
    // The closing edge ends at the expanded anchor dropped as a duplicate, not at the run's first.
    const end = polyline.anchorA![polyline.anchorA!.length - 1];
    expect(polylines[0].closeAnchor).toBeDefined();
    expect(end).toBe(polylines[0].closeAnchor);
    expect(end).not.toBe(polylines[0].anchorA![0]);
    expect(anchorSources![end]).toBe(0);
    expect(polyline.anchorB![polyline.anchorB!.length - 1]).toBe(end);
  });

  it('interpolates widths at a cut', () => {
    const run: Polyline = { ...anchored([0, 0, 10, 0], false), widths: Float32Array.from([2, 4]) };
    const [{ polyline }] = windowPolylines([run], { start: 0.5 })!;
    expect(polyline.widths![0]).toBe(3);
    expect(polyline.widths![1]).toBe(4);
  });
});
