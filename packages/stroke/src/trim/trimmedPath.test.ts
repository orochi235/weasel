import { describe, expect, it } from 'vitest';
import {
  PATH_C, PATH_L, PATH_M, PATH_Z, pathFromD, pointAtLength, type PolygonPath,
} from '@weasel-js/geom';
import { extractPolylines } from '@weasel-js/geom/tessellate';
import { polylineTable } from './windowPolylines';
import { trimmedPath } from './trimmedPath';

const poly = (d: string) => pathFromD(d) as PolygonPath;
const cut = (d: string, trim: Parameters<typeof trimmedPath>[1]) => {
  const out = trimmedPath(poly(d), trim)!;
  return { ...out, path: out.path as PolygonPath };
};
const coords = (p: PolygonPath) => Array.from(p.coords);

describe('trimmedPath', () => {
  it('keeps curves', () => {
    const d = 'M0 0 C0 100 100 100 100 0';
    const { path } = cut(d, { end: 0.5 });
    expect(Array.from(path.commands)).toEqual([PATH_M, PATH_C]);
    const table = polylineTable(extractPolylines(poly(d)));
    const { point } = pointAtLength(table, table.total / 2);
    const c = coords(path);
    expect(c[6]).toBeCloseTo(point[0], 3);
    expect(c[7]).toBeCloseTo(point[1], 3);
  });

  it('splits across subpaths', () => {
    const { path, dashPhases, fromClosed } = cut('M0 0 L10 0 M20 0 L30 0', { start: 0.25, end: 0.75 });
    expect(Array.from(path.commands)).toEqual([PATH_M, PATH_L, PATH_M, PATH_L]);
    expect(coords(path)).toEqual([5, 0, 10, 0, 20, 0, 25, 0]);
    expect(dashPhases).toEqual([5, 0]);
    expect(fromClosed).toEqual([false, false]);
  });

  it('gives the path back with no trim, and null for an empty window', () => {
    const p = poly('M0 0 L10 0');
    expect(trimmedPath(p, undefined)).toEqual({ path: p, dashPhases: [], fromClosed: [] });
    expect(trimmedPath(p, undefined)!.path).toBe(p);
    expect(trimmedPath(p, { start: 0.6, end: 0.4 })).toBeNull();
  });

  it('keeps a closed subpath the window covers whole closed, and opens one it cuts', () => {
    const whole = cut('M0 0 L10 0 L10 10 L0 10 Z', {});
    expect(Array.from(whole.path.commands)).toEqual([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]);
    expect(whole.fromClosed).toEqual([true]);
    const open = cut('M0 0 L10 0 L10 10 L0 10 Z', { start: 0.5, end: 0.875 });
    expect(Array.from(open.path.commands)).toEqual([PATH_M, PATH_L, PATH_L]);
    expect(coords(open.path)).toEqual([10, 10, 0, 10, 0, 5]);
    expect(open.dashPhases).toEqual([20]);
    expect(open.fromClosed).toEqual([true]);
  });

  it('measures a rect from its first corner', () => {
    const out = trimmedPath({ kind: 'rect', x: 0, y: 0, width: 100, height: 50 }, { end: { length: 120 } })!;
    const p = out.path as PolygonPath;
    expect(Array.from(p.commands)).toEqual([PATH_M, PATH_L, PATH_L]);
    expect(coords(p)).toEqual([0, 0, 100, 0, 100, 20]);
  });

  it('counts anchors in authored numbering on a cornered path', () => {
    const path = { ...poly('M0 0 L100 0 L100 100'), corners: [null, { shape: 'round', radius: 20 }, null] } as PolygonPath;
    const out = trimmedPath(path, { end: { anchor: 1 } })!.path as PolygonPath;
    expect(out.corners).toBeUndefined();
    const c = coords(out);
    const [x, y] = c.slice(-2);
    // The arc's midpoint, at -45 degrees about its center (80, 20).
    expect(x).toBeCloseTo(80 + 20 * Math.SQRT1_2, 1);
    expect(y).toBeCloseTo(20 - 20 * Math.SQRT1_2, 1);
  });

  it('keeps a polygon origin', () => {
    const p = { ...poly('M0 0 L10 0'), origin: { x: 1000, y: 2000 } };
    const out = trimmedPath(p, { end: 0.5 })!.path as PolygonPath;
    expect(out.origin).toEqual({ x: 1000, y: 2000 });
    expect(coords(out)).toEqual([0, 0, 5, 0]);
  });
});
