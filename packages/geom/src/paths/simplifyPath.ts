import type { PolygonPath } from '../path';
import { nearestOnCubic, nearestOnLine } from '../nearest';
import { anchorsToPath, pathToAnchors, type PenAnchor } from './anchors';
import { cubicPointAt, type Point } from './cubicMath';
import { fitCubicWithTangents } from './schneiderFit';

/** Options for {@link simplifyPath}. */
export interface SimplifyPathOptions {
  /**
   * An anchor whose path turns by more than this many degrees is a corner:
   * it is kept, and the curve is refitted on either side of it. Default 40.
   */
  cornerAngle?: number;
}

const CUBIC_SAMPLES = 12;
const MAX_LINE_SAMPLES = 8;
/** How many times longer than both neighbors a straight segment must be to be
 *  kept whole. */
const LONG_STRAIGHT = 4;

/**
 * `path` refitted with as few anchors as hold it within `tolerance`: every
 * point sampled along the original lies within `tolerance` of the result.
 * Corners (see {@link SimplifyPathOptions.cornerAngle}) and the ends of open
 * subpaths stay where they are; the runs between them are refitted as smooth
 * cubics, Schneider-style, and a run that lies within `tolerance` of a line
 * becomes one straight segment. Fill rules carry over.
 */
export function simplifyPath(
  path: PolygonPath,
  tolerance: number,
  opts: SimplifyPathOptions = {},
): PolygonPath {
  const tol = Math.max(tolerance, 1e-6);
  const cosCorner = Math.cos(((opts.cornerAngle ?? 40) * Math.PI) / 180);
  const { anchors, closed } = pathToAnchors(path);
  const out: PenAnchor[][] = [];
  const outClosed: boolean[] = [];
  anchors.forEach((sub, s) => {
    if (sub.length < 2) return;
    out.push(simplifySubpath(sub, closed[s], tol, cosCorner));
    outClosed.push(closed[s]);
  });
  return anchorsToPath(out, outClosed, path);
}

function simplifySubpath(sub: PenAnchor[], closed: boolean, tol: number, cosCorner: number): PenAnchor[] {
  const n = sub.length;
  const breaks = new Set<number>();
  for (let i = 0; i < n; i++) {
    if (isCorner(sub, i, closed, cosCorner)) breaks.add(i);
    if (isLongStraight(sub, i, closed)) {
      breaks.add(i);
      breaks.add((i + 1) % n);
    }
  }
  const corners = [...breaks].sort((a, b) => a - b);
  const result: PenAnchor[] = [];
  if (closed && corners.length === 0) {
    const pts = sampleRun(sub, 0, n, tol);
    const t = unit(sub2(pts[1], pts[pts.length - 2]));
    fitRun(pts, t, neg(t), tol, result, true);
    return result;
  }
  const stops = closed ? [...corners, corners[0] + n] : corners;
  for (let k = 0; k + 1 < stops.length; k++) {
    const pts = sampleRun(sub, stops[k], stops[k + 1], tol);
    const last = closed && k + 2 === stops.length;
    fitRun(pts, unit(sub2(pts[1], pts[0])), unit(sub2(pts[pts.length - 2], pts[pts.length - 1])), tol, result, last);
  }
  return result;
}

/** Whether the path turns at `sub[i]` by more than the corner angle. */
function isCorner(sub: PenAnchor[], i: number, closed: boolean, cosCorner: number): boolean {
  const n = sub.length;
  const a = sub[i];
  const prev = sub[(i - 1 + n) % n];
  const next = sub[(i + 1) % n];
  if (!closed && (i === 0 || i === n - 1)) return true;
  const from = a.inHandle && !same(a.inHandle, a) ? a.inHandle : prev.outHandle && !same(prev.outHandle, a) ? prev.outHandle : prev;
  const to = a.outHandle && !same(a.outHandle, a) ? a.outHandle : next.inHandle && !same(next.inHandle, a) ? next.inHandle : next;
  const d1 = unit(sub2(a, from));
  const d2 = unit(sub2(to, a));
  return d1.x * d2.x + d1.y * d2.y < cosCorner;
}

/** Whether the segment leaving `sub[i]` is straight and far longer than the
 *  segments either side: a flat between curves, kept whole rather than folded
 *  into a curve fitted across it. */
function isLongStraight(sub: PenAnchor[], i: number, closed: boolean): boolean {
  const n = sub.length;
  const len = (k: number): number => {
    if (!closed && (k < 0 || k >= n - 1)) return 0;
    const a = sub[(k + n) % n];
    const b = sub[(k + 1) % n];
    return Math.hypot(b.x - a.x, b.y - a.y);
  };
  if (!closed && i >= n - 1) return false;
  const a = sub[i];
  const b = sub[(i + 1) % n];
  if (a.outHandle || b.inHandle) return false;
  return len(i) >= LONG_STRAIGHT * Math.max(len(i - 1), len(i + 1));
}

/** Points along the anchors from index `from` to `to` (mod length), both
 *  anchors included. */
function sampleRun(sub: PenAnchor[], from: number, to: number, tol: number): Point[] {
  const n = sub.length;
  const pts: Point[] = [{ x: sub[from % n].x, y: sub[from % n].y }];
  for (let i = from; i < to; i++) {
    const a = sub[i % n];
    const b = sub[(i + 1) % n];
    if (!a.outHandle && !b.inHandle) {
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.min(MAX_LINE_SAMPLES, Math.max(1, Math.floor(len / (4 * tol))));
      for (let k = 1; k <= steps; k++) pts.push({ x: a.x + ((b.x - a.x) * k) / steps, y: a.y + ((b.y - a.y) * k) / steps });
    } else {
      const c1 = a.outHandle ?? a;
      const c2 = b.inHandle ?? b;
      for (let k = 1; k <= CUBIC_SAMPLES; k++) pts.push(cubicPointAt(a, c1, c2, b, k / CUBIC_SAMPLES));
    }
  }
  return dedupe(pts);
}

/**
 * Fit `pts` with cubics held to the end tangents, splitting at the worst
 * sample until every sample is within `tol`, and append the anchors after the
 * first to `out` (the first too when `out` is empty). `closing` folds the
 * final anchor, which lands on the subpath's first, into that first one.
 */
function fitRun(pts: Point[], tStart: Point, tEnd: Point, tol: number, out: PenAnchor[], closing: boolean): void {
  if (out.length === 0) out.push({ x: pts[0].x, y: pts[0].y });
  const segs: Array<{ c1?: Point; c2?: Point; end: Point }> = [];
  fitRecursive(pts, tStart, tEnd, tol, segs);
  segs.forEach((seg, i) => {
    const prev = out[out.length - 1];
    if (seg.c1) prev.outHandle = seg.c1;
    const isLast = i === segs.length - 1;
    if (closing && isLast) {
      if (seg.c2) out[0].inHandle = seg.c2;
      return;
    }
    out.push(seg.c2 ? { x: seg.end.x, y: seg.end.y, inHandle: seg.c2 } : { x: seg.end.x, y: seg.end.y });
  });
}

function fitRecursive(
  pts: Point[], tStart: Point, tEnd: Point, tol: number,
  out: Array<{ c1?: Point; c2?: Point; end: Point }>,
): void {
  const a = pts[0];
  const e = pts[pts.length - 1];
  if (pts.length <= 2 || worstFromLine(pts, a, e).dist <= tol) {
    out.push({ end: e });
    return;
  }
  const { cp1, cp2 } = fitCubicWithTangents(pts, tStart, tEnd);
  const worst = worstFromCubic(pts, a, cp1, cp2, e);
  if (worst.dist <= tol) {
    out.push({ c1: cp1, c2: cp2, end: e });
    return;
  }
  const k = worst.index;
  const center = unit(sub2(pts[k + 1], pts[k - 1]));
  fitRecursive(pts.slice(0, k + 1), tStart, neg(center), tol, out);
  fitRecursive(pts.slice(k), center, tEnd, tol, out);
}

function worstFromLine(pts: Point[], a: Point, e: Point): { index: number; dist: number } {
  let index = 1, dist = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = nearestOnLine(pts[i].x, pts[i].y, a.x, a.y, e.x, e.y).dist;
    if (d > dist) { dist = d; index = i; }
  }
  return { index, dist };
}

function worstFromCubic(pts: Point[], a: Point, c1: Point, c2: Point, e: Point): { index: number; dist: number } {
  let index = 1, dist = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = nearestOnCubic(pts[i].x, pts[i].y, a.x, a.y, c1.x, c1.y, c2.x, c2.y, e.x, e.y).dist;
    if (d > dist) { dist = d; index = i; }
  }
  return { index, dist };
}

function dedupe(pts: Point[]): Point[] {
  return pts.filter((p, i) => i === 0 || !same(p, pts[i - 1]));
}

const same = (p: Point, q: Point): boolean => p.x === q.x && p.y === q.y;
const sub2 = (p: Point, q: Point): Point => ({ x: p.x - q.x, y: p.y - q.y });
const neg = (p: Point): Point => ({ x: -p.x, y: -p.y });
function unit(p: Point): Point {
  const len = Math.hypot(p.x, p.y);
  return len === 0 ? { x: 0, y: 0 } : { x: p.x / len, y: p.y / len };
}
