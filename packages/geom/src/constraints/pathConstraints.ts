/**
 * Constraints on a `PolygonPath`: solving them over its anchors, and carrying
 * them through an edit that renumbers the anchors.
 */

import type { PolygonPath } from '../path';
import { anchorPointIndices, type PointOrigin } from '../paths/anchorOrigins';
import { anchorAt, editAnchorSet } from '../paths/anchorEdits';
import { pathToAnchors } from '../paths/anchors';
import type { ConstraintPoint } from './points';
import { solveConstraints, type SolveConstraintsOptions, type SolveConstraintsResult } from './solve';
import { mapConstraintAnchors, type AnchorPair, type PathConstraint } from './types';

/** Every anchor of `path`, by flat index, with the handles it has. */
export function pathAnchorPoints(path: PolygonPath): ConstraintPoint[] {
  return pathToAnchors(path).anchors.flat().map((a) => {
    const p: ConstraintPoint = { x: a.x, y: a.y };
    if (a.inHandle) p.inHandle = { ...a.inHandle };
    if (a.outHandle) p.outHandle = { ...a.outHandle };
    return p;
  });
}

const samePoint = (a: { x: number; y: number } | undefined, b: { x: number; y: number } | undefined) =>
  a === b || (!!a && !!b && a.x === b.x && a.y === b.y);

/** Whether the solve moved anchor `p` to `q` or turned either of its handles. */
const moved = (p: ConstraintPoint, q: ConstraintPoint) =>
  !samePoint(p, q) || !samePoint(p.inHandle, q.inHandle) || !samePoint(p.outHandle, q.outHandle);

/** {@link solveConstraints} over `path`'s anchors, and `path` with them moved. */
export interface SolvePathConstraintsResult extends SolveConstraintsResult {
  /** `path` with each anchor moved where the solve put it, its handles moved with it; `path` itself when none moved. */
  path: PolygonPath;
}

/**
 * Solve `constraints` over the anchors of `path` and write the result back,
 * carrying each moved anchor's handles with it so its curves keep their
 * shape, except where a `tangent` turned them.
 */
export function solvePathConstraints(
  path: PolygonPath,
  constraints: readonly PathConstraint[],
  opts: SolveConstraintsOptions = {},
): SolvePathConstraintsResult {
  const points = pathAnchorPoints(path);
  const result = solveConstraints(points, constraints, opts);
  return { ...result, path: withAnchorPoints(path, points, result.points) };
}

/**
 * `path` with its anchors and handles where `to` puts them, given `from`,
 * where they are now; `path` itself when nothing moved.
 */
export function withAnchorPoints(
  path: PolygonPath,
  from: readonly ConstraintPoint[],
  to: readonly ConstraintPoint[],
): PolygonPath {
  const moves = to.flatMap((p, i) => (moved(from[i], p) ? [i] : []));
  if (moves.length === 0) return path;
  const next = editAnchorSet(path, (set) => {
    for (const i of moves) {
      const a = anchorAt(set, i)!;
      const p = to[i];
      a.x = p.x;
      a.y = p.y;
      if (a.inHandle && p.inHandle) a.inHandle = { ...p.inHandle };
      if (a.outHandle && p.outHandle) a.outHandle = { ...p.outHandle };
    }
  });
  return next ?? path;
}

/**
 * For each anchor of `after`, the anchor of `before` it is: the one whose
 * point `origins` says it was copied from. An anchor the edit made has none.
 * `origins` is what `editAnchorSetTracked` answered for the edit.
 */
export function anchorsBefore(
  before: PolygonPath,
  after: PolygonPath,
  origins: readonly (PointOrigin | null)[],
): (number | undefined)[] {
  const anchorOfPoint = new Map<number, number>();
  anchorPointIndices(before).forEach((point, anchor) => anchorOfPoint.set(point, anchor));
  return anchorPointIndices(after).map((point) => {
    const o = origins[point];
    if (!o || (o.t !== 0 && o.a !== o.b)) return undefined;
    return anchorOfPoint.get(o.a);
  });
}

/**
 * `constraints` renumbered for the anchors of a path after an edit, given
 * `wasAnchor` — for each new anchor, the old one it is, as
 * {@link anchorsBefore} answers. A constraint naming an anchor the edit
 * removed is dropped; `from` holds each kept one's index in `constraints`.
 */
export function remapConstraints(
  constraints: readonly PathConstraint[],
  wasAnchor: readonly (number | undefined)[],
): { constraints: PathConstraint[]; from: number[] } {
  const now = new Map<number, number>();
  wasAnchor.forEach((old, i) => {
    if (old !== undefined && !now.has(old)) now.set(old, i);
  });
  const out: PathConstraint[] = [];
  const from: number[] = [];
  constraints.forEach((c, i) => {
    const mapped = mapConstraintAnchors(c, (a) => now.get(a));
    if (!mapped) return;
    out.push(mapped);
    from.push(i);
  });
  return { constraints: out, from };
}

/**
 * The segment of `path` joining anchors `a` and `b`, as the pair in the order
 * the path runs it, or null when no segment joins them.
 */
export function segmentBetween(path: PolygonPath, a: number, b: number): AnchorPair | null {
  const { anchors, closed } = pathToAnchors(path);
  let base = 0;
  for (let s = 0; s < anchors.length; s++) {
    const n = anchors[s].length;
    const next = (i: number) => (i + 1 < n ? i + 1 : closed[s] && n > 2 ? 0 : -1);
    for (const [p, q] of [[a, b], [b, a]] as const) {
      const i = p - base;
      if (i >= 0 && i < n && next(i) >= 0 && base + next(i) === q) return [p, q];
    }
    base += n;
  }
  return null;
}

