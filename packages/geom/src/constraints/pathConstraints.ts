/**
 * Constraints on a `PolygonPath`: solving them over its anchors, and carrying
 * them through an edit that renumbers the anchors.
 */

import type { PolygonPath } from '../path';
import { anchorPointIndices, type PointOrigin } from '../paths/anchorOrigins';
import { editAnchorSet, translateAnchorBy } from '../paths/anchorEdits';
import { pathToAnchors } from '../paths/anchors';
import {
  solveConstraints,
  unsatisfiedConstraints,
  type ConstraintPoint,
  type SolveConstraintsOptions,
  type SolveConstraintsResult,
} from './solve';
import { mapConstraintAnchors, type PathConstraint } from './types';

/** Every anchor of `path`, by flat index. */
export function pathAnchorPoints(path: PolygonPath): ConstraintPoint[] {
  return pathToAnchors(path).anchors.flat().map((a) => ({ x: a.x, y: a.y }));
}

/** {@link solveConstraints} over `path`'s anchors, and `path` with them moved. */
export interface SolvePathConstraintsResult extends SolveConstraintsResult {
  /** `path` with each anchor moved where the solve put it, its handles moved with it; `path` itself when none moved. */
  path: PolygonPath;
}

/**
 * Solve `constraints` over the anchors of `path` and write the result back,
 * carrying each moved anchor's handles with it so its curves keep their shape.
 */
export function solvePathConstraints(
  path: PolygonPath,
  constraints: readonly PathConstraint[],
  opts: SolveConstraintsOptions = {},
): SolvePathConstraintsResult {
  const points = pathAnchorPoints(path);
  const result = solveConstraints(points, constraints, opts);
  const moves = result.points.map((p, i) => ({ i, dx: p.x - points[i].x, dy: p.y - points[i].y }))
    .filter((m) => m.dx !== 0 || m.dy !== 0);
  if (moves.length === 0) return { ...result, path };
  const next = editAnchorSet(path, (set) => {
    for (const m of moves) translateAnchorBy(set, m.i, m.dx, m.dy);
  });
  return { ...result, path: next ?? path };
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

/** Options for {@link constrainPathEdit}. */
export interface ConstrainPathEditOptions {
  /**
   * Where each point of the edited path came from, as `editAnchorSetTracked`
   * answers. Absent, the edit is taken to keep every anchor's number, and one
   * that changes the anchor count drops every constraint.
   */
  origins?: readonly (PointOrigin | null)[];
  /** See {@link SolveConstraintsOptions.axisAngle}. */
  axisAngle?: number;
}

/** What {@link constrainPathEdit} answers. */
export interface ConstrainedPathEdit {
  /** The edited path with the constraints holding again. */
  path: PolygonPath;
  /** The constraints renumbered for `path`'s anchors. */
  constraints: PathConstraint[];
  /** Whether every constraint that held before the edit holds after it. */
  converged: boolean;
  /** Indices into `constraints` of the ones that do not hold, including any that already did not before the edit. */
  unsatisfied: number[];
}

/**
 * An edit of a constrained path, `before` → `after`, finished so its
 * constraints hold: the anchors the edit moved are held, `fixed` anchors go
 * back to where they were, and the rest move the least they must. A
 * constraint that did not hold before the edit conflicts with the others and
 * is left out of the solve rather than allowed to pull them out of true;
 * `unsatisfied` reports it.
 */
export function constrainPathEdit(
  before: PolygonPath,
  after: PolygonPath,
  constraints: readonly PathConstraint[],
  opts: ConstrainPathEditOptions = {},
): ConstrainedPathEdit {
  const { axisAngle } = opts;
  const was = pathAnchorPoints(before);
  const now = pathAnchorPoints(after);
  const wasAnchor = opts.origins
    ? anchorsBefore(before, after, opts.origins)
    : now.map((_, i) => (now.length === was.length ? i : undefined));
  const broken = new Set(unsatisfiedConstraints(was, constraints, { axisAngle }));
  const { constraints: kept, from } = remapConstraints(constraints, wasAnchor);
  const skip = from.flatMap((old, i) => (broken.has(old) ? [i] : []));
  const reference = wasAnchor.map((old) => (old === undefined ? undefined : was[old]));
  const held = now.flatMap((p, i) => {
    const r = reference[i];
    return !r || r.x !== p.x || r.y !== p.y ? [i] : [];
  });
  const solved = solvePathConstraints(after, kept, { held, reference, skip, axisAngle });
  return { path: solved.path, constraints: kept, converged: solved.converged, unsatisfied: solved.unsatisfied };
}
