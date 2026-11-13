import { describe, expect, it } from 'vitest';
import { PATH_C, PATH_L, PATH_M, PATH_Z, pathFromD, type PolygonPath } from '@weasel-js/geom';
import { trimmedPath, trimmedRuns } from './trimmedPath';

const poly = (d: string) => pathFromD(d) as PolygonPath;
const cut = (d: string, trim: Parameters<typeof trimmedPath>[1]) => {
  const out = trimmedPath(poly(d), trim)!;
  return { ...out, path: out.path as PolygonPath };
};
const coords = (p: PolygonPath) => Array.from(p.coords);
const LOPSIDED_C = [0, 0, 100, 100, 0, 100, 100, 0] as const;
const LOPSIDED = `M${LOPSIDED_C.slice(0, 2).join(' ')} C${LOPSIDED_C.slice(2).join(' ')}`;
/** The point a share `f` of the way along a cubic by arc length, from a dense chord walk. */
function atArcShare(c: readonly number[], f: number): [number, number] {
  const n = 200_000;
  const at = (t: number): [number, number] => {
    const u = 1 - t;
    const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
    return [k[0] * c[0] + k[1] * c[2] + k[2] * c[4] + k[3] * c[6], k[0] * c[1] + k[1] * c[3] + k[2] * c[5] + k[3] * c[7]];
  };
  const cum = [0];
  let prev = at(0);
  for (let i = 1; i <= n; i++) {
    const p = at(i / n);
    cum.push(cum[i - 1] + Math.hypot(p[0] - prev[0], p[1] - prev[1]));
    prev = p;
  }
  const want = f * cum[n];
  let i = 1;
  while (cum[i] < want) i++;
  return at((i - 1 + (want - cum[i - 1]) / (cum[i] - cum[i - 1])) / n);
}

describe('trimmedPath', () => {
  it('keeps curves', () => {
    const { path } = cut(LOPSIDED, { end: 0.3 });
    expect(Array.from(path.commands)).toEqual([PATH_M, PATH_C]);
    const c = coords(path);
    // The cut piece starts where the curve does and ends on it, at the share of its length the window reaches.
    expect(c.slice(0, 2)).toEqual([0, 0]);
    const [x, y] = atArcShare(LOPSIDED_C, 0.3);
    expect(c[6]).toBeCloseTo(x, 3);
    expect(c[7]).toBeCloseTo(y, 3);
  });

  it('cuts a curve at the exact share of its length', () => {
    for (const f of [0.1, 0.25, 0.6, 0.85]) {
      const c = coords(cut(LOPSIDED, { start: f }).path);
      const [x, y] = atArcShare(LOPSIDED_C, f);
      expect(c[0], `start ${f}`).toBeCloseTo(x, 3);
      expect(c[1], `start ${f}`).toBeCloseTo(y, 3);
    }
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

describe('trimmedRuns', () => {
  // A closed square, then an open line.
  const D = 'M0 0 L100 0 L100 100 L0 100 Z M200 0 L300 0';

  it('keeps one stroke unless asked to part closed runs from open ones', () => {
    const whole = cut(D, {});
    expect(trimmedRuns(whole, { dashed: true })).toEqual([{ path: whole.path, dashPhase: 0, fromClosed: true }]);
    expect(trimmedRuns(whole, { dashed: true, byClosed: true }).map((r) => [r.dashPhase, r.fromClosed])).toEqual([[0, true], [0, false]]);
  });

  it('parts runs whose dash phases differ only when dashed', () => {
    const late = cut(D, { start: { length: 10 } });
    expect(late.dashPhases).toEqual([10, 0]);
    expect(trimmedRuns(late)).toHaveLength(1);
    expect(trimmedRuns(late, { dashed: true }).map((r) => r.dashPhase)).toEqual([10, 0]);
  });
});
