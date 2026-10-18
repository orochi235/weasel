/**
 * Constraints on a `PolygonPath`: solving them over its anchors, and carrying
 * them through an edit that renumbers the anchors.
 */

import type { PolygonPath } from '../path';
import { anchorPointIndices, type PointOrigin } from '../paths/anchorOrigins';
import { anchorAt, editAnchorSet } from '../paths/anchorEdits';
import { pathToAnchors } from '../paths/anchors';
import { unsatisfiedConstraints } from './check';
import type { ConstraintPoint, HandleRef } from './points';
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
  const moves = result.points.flatMap((p, i) => (moved(points[i], p) ? [i] : []));
  if (moves.length === 0) return { ...result, path };
  const next = editAnchorSet(path, (set) => {
    for (const i of moves) {
      const a = anchorAt(set, i)!;
      const p = result.points[i];
      a.x = p.x;
      a.y = p.y;
      if (a.inHandle && p.inHandle) a.inHandle = { ...p.inHandle };
      if (a.outHandle && p.outHandle) a.outHandle = { ...p.outHandle };
    }
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

/** The handles of `now` turned or stretched from where their anchors' `reference` had them. */
function handlesMoved(now: readonly ConstraintPoint[], reference: readonly (ConstraintPoint | undefined)[]): HandleRef[] {
  const offset = (p: ConstraintPoint, h: { x: number; y: number } | undefined) => h && { x: h.x - p.x, y: h.y - p.y };
  // Translating an anchor moves its handles by the same amount, which can round their offsets.
  const near = (a?: { x: number; y: number }, b?: { x: number; y: number }) =>
    a === b || (!!a && !!b && Math.abs(a.x - b.x) <= 1e-9 * (1 + Math.abs(a.x)) && Math.abs(a.y - b.y) <= 1e-9 * (1 + Math.abs(a.y)));
  return now.flatMap((p, anchor) => {
    const r = reference[anchor];
    if (!r) return [];
    const sides: HandleRef[] = [];
    if (!near(offset(p, p.inHandle), offset(r, r.inHandle))) sides.push({ anchor, side: 'in' });
    if (!near(offset(p, p.outHandle), offset(r, r.outHandle))) sides.push({ anchor, side: 'out' });
    return sides;
  });
}

/**
 * An edit of a constrained path, `before` → `after`, finished so its
 * constraints hold: the anchors and handles the edit moved are held, `fixed` anchors go
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
  // An `onPath` whose segment the edit split or broke has no segment left to hold its anchor on.
  const remapped = remapConstraints(constraints, wasAnchor);
  const joined = remapped.constraints.map((c) => c.kind !== 'onPath' || !!segmentBetween(after, ...c.segment));
  const kept = remapped.constraints.filter((_, i) => joined[i]);
  const from = remapped.from.filter((_, i) => joined[i]);
  const skip = from.flatMap((old, i) => (broken.has(old) ? [i] : []));
  const reference = wasAnchor.map((old) => (old === undefined ? undefined : was[old]));
  const held = now.flatMap((p, i) => {
    const r = reference[i];
    return !r || r.x !== p.x || r.y !== p.y ? [i] : [];
  });
  const heldHandles = handlesMoved(now, reference);
  const solved = solvePathConstraints(after, kept, { held, heldHandles, reference, skip, axisAngle });
  return { path: solved.path, constraints: kept, converged: solved.converged, unsatisfied: solved.unsatisfied };
}
