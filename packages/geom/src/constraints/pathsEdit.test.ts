import { describe, expect, it } from 'vitest';
import { polygonFromPoints } from '../paths/builder';
import { deleteAnchorsAt, translateAnchorBy } from '../paths/anchorEdits';
import { editAnchorSetTracked } from '../paths/anchorOrigins';
import type { PolygonPath } from '../path';
import { pathAnchorPoints } from './pathConstraints';
import { constrainPathsEdit, type PathLink } from './pathsEdit';

const poly = (...pts: [number, number][]) => polygonFromPoints(pts.map(([x, y]) => ({ x, y }))) as PolygonPath;

/** A triangle, its first side vertical, whose anchor 0 sits on the bottom edge of a square, anchors 0 → 1 of path 1. */
const triangle = () => poly([40, 0], [40, -50], [10, -50]);
const square = () => poly([0, 0], [100, 0], [100, 100], [0, 100]);
/** Anchor 0 of the triangle, held on the square's segment 3 → 4 in link numbering: its anchors 0 → 1. */
const ON_EDGE: PathLink = { constraint: { kind: 'onPath', anchor: 0, segment: [3, 4] }, paths: [0, 1] };

function drag(path: PolygonPath, anchor: number, dx: number, dy: number) {
  return editAnchorSetTracked(path, (set) => {
    translateAnchorBy(set, anchor, dx, dy);
  })!;
}

describe('constrainPathsEdit', () => {
  it('slides an anchor held on another path along it, leaving that path alone', () => {
    const tri = triangle();
    const sq = square();
    const edit = drag(tri, 0, 15, 20);
    const r = constrainPathsEdit([
      { before: tri, after: edit.path, constraints: [], origins: edit.origins },
      { before: sq, after: sq, constraints: [] },
    ], [ON_EDGE]);
    expect(r.converged).toBe(true);
    const p = pathAnchorPoints(r.items[0].path)[0];
    expect(p.x).toBeCloseTo(55, 1);
    expect(Math.abs(p.y)).toBeLessThan(1e-3);
    expect(r.items[1].path).toBe(sq);
  });

  it('carries the held anchor with the path it is held on, keeping its own path true', () => {
    const sq = square();
    const edit = drag(sq, 1, 0, 40);
    const tri = triangle();
    const r = constrainPathsEdit([
      { before: tri, after: tri, constraints: [{ kind: 'vertical', segment: [0, 1] }] },
      { before: sq, after: edit.path, constraints: [], origins: edit.origins },
    ], [ON_EDGE]);
    expect(r.converged).toBe(true);
    const [s0, s1] = pathAnchorPoints(r.items[1].path);
    expect(s1).toEqual({ x: 100, y: 40 });
    const [a, b] = pathAnchorPoints(r.items[0].path);
    // On the tilted edge, and still straight below the triangle's next anchor.
    expect(Math.abs((s1.x - s0.x) * (a.y - s0.y) - (s1.y - s0.y) * (a.x - s0.x))).toBeLessThan(1e-2);
    expect(a.x).toBeCloseTo(b.x, 3);
    expect(r.links[0].satisfied).toBe(true);
  });

  it('renumbers a link through an edit of either path, and drops it with an anchor it names', () => {
    const sq = poly([0, 50], [0, 0], [100, 0], [100, 100], [0, 100]);
    const link: PathLink = { constraint: { kind: 'onPath', anchor: 0, segment: [4, 5] }, paths: [0, 1] };
    const removed = editAnchorSetTracked(sq, (set) => deleteAnchorsAt(set, [0]))!;
    const tri = triangle();
    const r = constrainPathsEdit([
      { before: tri, after: tri, constraints: [] },
      { before: sq, after: removed.path, constraints: [], origins: removed.origins },
    ], [link]);
    expect(r.links[0].constraint).toEqual({ kind: 'onPath', anchor: 0, segment: [3, 4] });
    const gone = editAnchorSetTracked(tri, (set) => deleteAnchorsAt(set, [0]))!;
    const r2 = constrainPathsEdit([
      { before: tri, after: gone.path, constraints: [], origins: gone.origins },
      { before: sq, after: sq, constraints: [] },
    ], [link]);
    expect(r2.links[0].constraint).toBeNull();
  });
});
