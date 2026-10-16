import { describe, expect, it } from 'vitest';
import type { PolygonPath } from '../path';
import { warpPath } from '../warp/warpPath';
import { pathToAnchors } from './anchors';
import { carryCorners, flatAnchorIndices } from './cornerCarry';
import { cornerSpecAt, withCorner, type CornerSpec } from './cornerSpec';
import { pathToCubicContours } from './cubicContours';
import { pathFromD } from './pathFromD';
import { resamplePath } from './resamplePath';
import { simplifyPath } from './simplifyPath';
import { splitByClosure } from './splitByClosure';
import { splitSubpaths } from './splitSubpaths';
import { reversePath } from './winding';

const ROUND: CornerSpec = { shape: 'round', radius: 2 };
const BEVEL: CornerSpec = { shape: 'bevel', radius: 1 };
const SCOOP: CornerSpec = { shape: 'scoop', radius: 3 };

const withCorners = (d: string, specs: Record<number, CornerSpec>): PolygonPath =>
  Object.entries(specs).reduce((p, [i, s]) => withCorner(p, Number(i), s), pathFromD(d) as PolygonPath);

/** Each anchor carrying a spec, keyed by where it sits. */
const cornersByPoint = (path: PolygonPath): Record<string, CornerSpec> => {
  const out: Record<string, CornerSpec> = {};
  for (const a of pathToAnchors(path).anchors.flat()) if (a.corner) out[`${a.x},${a.y}`] = a.corner;
  return out;
};

// A closed square (flat 0–3), then an open run (flat 4–6).
const SQUARE_THEN_RUN = 'M0 0 L10 0 L10 10 L0 10 Z M20 0 L30 0 L30 10';
const twoSubpaths = () => withCorners(SQUARE_THEN_RUN, { 1: ROUND, 3: BEVEL, 5: SCOOP });

describe('corner specs through path rewrites', () => {
  it('splitSubpaths gives each subpath the specs of its own anchors', () => {
    const [square, run] = splitSubpaths(twoSubpaths());
    expect(cornersByPoint(square)).toEqual({ '10,0': ROUND, '0,10': BEVEL });
    expect(cornersByPoint(run)).toEqual({ '30,0': SCOOP });
    expect(cornerSpecAt(run, 1)).toEqual(SCOOP);
    expect(run.corners).toHaveLength(2);
  });

  it('splitByClosure renumbers specs when it regroups subpaths', () => {
    const path = withCorners('M20 0 L30 0 L30 10 M0 0 L10 0 L10 10 L0 10 Z M40 0 L50 0 L50 10', {
      1: SCOOP, 4: ROUND, 8: BEVEL,
    });
    const { closed, open } = splitByClosure(path);
    expect(cornersByPoint(closed!)).toEqual({ '10,0': ROUND });
    expect(cornerSpecAt(closed!, 1)).toEqual(ROUND);
    expect(cornersByPoint(open!)).toEqual({ '30,0': SCOOP, '50,0': BEVEL });
    expect(cornerSpecAt(open!, 4)).toEqual(BEVEL);
  });

  it('reversePath keeps every spec on its anchor', () => {
    const reversed = reversePath(twoSubpaths());
    expect(cornersByPoint(reversed)).toEqual(cornersByPoint(twoSubpaths()));
    expect(cornerSpecAt(reversed, 3)).toEqual(ROUND);
    expect(cornerSpecAt(reversed, 1)).toEqual(BEVEL);
  });

  it('reversePath carries a spec on a closed contour whose closing curve folds', () => {
    const path = withCorners('M0 0 L10 0 L10 10 C5 15 0 5 0 0 Z M20 0 L30 0 L30 10 Z', { 0: ROUND, 1: BEVEL, 4: SCOOP });
    const reversed = reversePath(path);
    expect(cornersByPoint(reversed)).toEqual(cornersByPoint(path));
  });

  it('simplifyPath keeps the spec on a corner it keeps', () => {
    const path = withCorners('M0 0 L5 0 L10 0 L10 10 L0 10 Z', { 2: ROUND, 4: BEVEL });
    const simple = simplifyPath(path, 0.1);
    expect(pathToAnchors(simple).anchors[0]).toHaveLength(4);
    expect(cornersByPoint(simple)).toEqual({ '10,0': ROUND, '0,10': BEVEL });
  });

  it('resamplePath keeps the spec on each corner it holds in place', () => {
    const path = withCorners('M0 0 L10 0 L10 10 L0 10 Z', { 1: ROUND, 3: BEVEL });
    const resampled = resamplePath(path, { count: 8 });
    expect(pathToAnchors(resampled).anchors[0]).toHaveLength(8);
    expect(cornersByPoint(resampled)).toEqual({ '10,0': ROUND, '0,10': BEVEL });
  });

  it('warpPath keeps each spec on the anchor it maps', () => {
    const warped = warpPath(twoSubpaths(), (p) => ({ x: p.x + 100, y: p.y }));
    expect(cornersByPoint(warped)).toEqual({ '110,0': ROUND, '100,10': BEVEL, '130,0': SCOOP });
  });

  it('pathToCubicContours reads the expanded corners', () => {
    const contours = pathToCubicContours(withCorners('M0 0 L10 0 L10 10 L0 10 Z', { 1: ROUND }));
    expect(contours[0].segs.length).toBeGreaterThan(4);
  });
});

describe('carryCorners', () => {
  it('numbers a folded closing curve as its subpath\'s first anchor', () => {
    const path = pathFromD('M0 0 L10 0 C10 10 0 10 0 0 Z M20 0 L30 0') as PolygonPath;
    expect(Array.from(flatAnchorIndices(path))).toEqual([0, 1, 0, 2, 3]);
  });

  it('lands each spec once and drops one with no source', () => {
    const from = withCorners('M0 0 L10 0 L10 10 Z', { 0: ROUND, 1: BEVEL });
    const to = pathFromD('M0 0 L10 10 L10 0 L0 0 Z') as PolygonPath;
    const carried = carryCorners(from, to, [0, -1, 1, 0]);
    expect(carried.corners).toEqual([ROUND, null, BEVEL]);
  });
});
