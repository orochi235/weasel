/**
 * Spiro curves as cubic paths, and back. A solved curve is written as cubics,
 * each spiral segment split into as many as it takes to stay within tolerance,
 * so most anchors of the path are not spiro points. `at` records which are:
 * `at[i]` is the flat anchor index of point `i`, counted across subpaths. The
 * points are then read back out of the path itself, so whatever moves the path
 * — a move, a resize, a rotation — moves them with it.
 */
import type { PolygonPath } from '../path';
import { anchorsToPath, pathToAnchors, type PenAnchor } from './anchors';
import { eulerCubicError, eulerSegmentCubic, subEulerSegment, type EulerSegment } from './eulerSpiral';
import { solveSpiro, type SpiroKind, type SpiroPoint } from './spiro';

/** One subpath of a spiro curve: its points, and whether it closes. */
export interface SpiroContour {
  points: SpiroPoint[];
  closed: boolean;
}

/** A spiro curve written as a cubic path, with the anchor each point became. */
export interface SpiroPath {
  path: PolygonPath;
  /** The flat anchor index of each point, in contour order. */
  at: number[];
}

/** Options for {@link spiroToPath}. */
export interface SpiroToPathOptions {
  /** The furthest a cubic may stray from its spiral, as a fraction of that
   *  segment's arc length. Default `1e-4`. */
  tolerance?: number;
  /** The path being reshaped, whose fill rules the result keeps. */
  like?: PolygonPath;
}

const MAX_PIECES = 16;

interface Piece { end: EulerSegment; c1: { x: number; y: number }; c2: { x: number; y: number } }

/** `spiral` as the fewest equal pieces whose cubics all stay within `tol`. */
function cubicPieces(spiral: EulerSegment, tol: number): Piece[] {
  let best: Piece[] = [];
  for (let m = 1; m <= MAX_PIECES; m++) {
    best = [];
    let fits = true;
    for (let j = 0; j < m; j++) {
      const piece = m === 1 ? spiral : subEulerSegment(spiral, j / m, (j + 1) / m);
      const { c1, c2 } = eulerSegmentCubic(piece);
      best.push({ end: piece, c1, c2 });
      if (eulerCubicError(piece, c1, c2) > tol * spiral.length) fits = false;
    }
    if (fits) break;
  }
  return best;
}

function contourAnchors(c: SpiroContour, tol: number): { anchors: PenAnchor[]; at: number[] } {
  const anchors: PenAnchor[] = [];
  const at: number[] = [];
  const segments = solveSpiro(c.points, c.closed);
  // The handle the last piece of a segment arrives with, for the point after it.
  let arriving: { x: number; y: number } | null = null;
  c.points.forEach((p, i) => {
    at.push(anchors.length);
    anchors.push({ x: p.x, y: p.y, ...(arriving ? { inHandle: arriving } : {}) });
    arriving = null;
    const spiral = segments[i]?.spiral;
    if (!spiral) return;
    const pieces = cubicPieces(spiral, tol);
    pieces.forEach((piece, j) => {
      anchors[anchors.length - 1].outHandle = { x: piece.c1.x, y: piece.c1.y };
      const c2 = { x: piece.c2.x, y: piece.c2.y };
      if (j < pieces.length - 1) anchors.push({ x: piece.end.p1.x, y: piece.end.p1.y, inHandle: c2 });
      else arriving = c2;
    });
  });
  if (arriving) anchors[0].inHandle = arriving;
  return { anchors, at };
}

/**
 * Solve each contour and write it as a cubic path. Straight segments carry no
 * handles.
 */
export function spiroToPath(contours: readonly SpiroContour[], options: SpiroToPathOptions = {}): SpiroPath {
  const tol = options.tolerance ?? 1e-4;
  const subs: PenAnchor[][] = [];
  const closed: boolean[] = [];
  const at: number[] = [];
  let base = 0;
  for (const c of contours) {
    if (c.points.length === 0) continue;
    const written = contourAnchors(c, tol);
    subs.push(written.anchors);
    closed.push(c.closed && c.points.length > 2);
    at.push(...written.at.map((i) => i + base));
    base += written.anchors.length;
  }
  return { path: anchorsToPath(subs, closed, options.like), at };
}

/**
 * The spiro points `path` holds, given the kind of each and the anchor each
 * became. Null when `kinds` and `at` do not describe `path`: the counts
 * differ, an index is out of order or out of range, or a subpath does not
 * start on a point.
 */
export function spiroContoursOf(
  path: PolygonPath,
  kinds: readonly SpiroKind[],
  at: readonly number[],
): SpiroContour[] | null {
  if (kinds.length !== at.length || at.length === 0) return null;
  const { anchors, closed } = pathToAnchors(path);
  const contours: SpiroContour[] = [];
  let flat = 0;
  let k = 0;
  for (let s = 0; s < anchors.length; s++) {
    const sub = anchors[s];
    if (at[k] !== flat) return null;
    const points: SpiroPoint[] = [];
    while (k < at.length && at[k] < flat + sub.length) {
      if (k > 0 && at[k] <= at[k - 1]) return null;
      const a = sub[at[k] - flat];
      points.push({ x: a.x, y: a.y, kind: kinds[k] });
      k++;
    }
    contours.push({ points, closed: closed[s] });
    flat += sub.length;
  }
  return k === at.length ? contours : null;
}

/** The straight-sided path through each contour's points: what an editor
 *  shows and moves in place of the curve. */
export function spiroControlPath(contours: readonly SpiroContour[]): PolygonPath {
  return anchorsToPath(
    contours.map((c) => c.points.map((p) => ({ x: p.x, y: p.y }))),
    contours.map((c) => c.closed),
  );
}

const key = (x: number, y: number): string => `${Math.round(x * 1e3)},${Math.round(y * 1e3)}`;

/**
 * Read an edited control path back as contours: every anchor is a point.
 * Kinds follow from `before`, the contours the edit started from: point for
 * point when the count is unchanged, else by position, with an anchor that
 * lands nowhere a point was taking `fallback`. Handles are ignored.
 */
export function spiroContoursFromControl(
  control: PolygonPath,
  before: readonly SpiroContour[],
  fallback: SpiroKind = 'smooth',
): SpiroContour[] {
  const { anchors, closed } = pathToAnchors(control);
  const old = before.flatMap((c) => c.points);
  const count = anchors.reduce((n, sub) => n + sub.length, 0);
  const byPlace = new Map<string, SpiroKind>();
  for (const p of old) if (!byPlace.has(key(p.x, p.y))) byPlace.set(key(p.x, p.y), p.kind);
  let i = 0;
  return anchors.map((sub, s) => ({
    closed: closed[s],
    points: sub.map((a) => {
      const kind = count === old.length ? old[i].kind : byPlace.get(key(a.x, a.y)) ?? fallback;
      i++;
      return { x: a.x, y: a.y, kind };
    }),
  }));
}
