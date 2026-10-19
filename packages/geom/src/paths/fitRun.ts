/**
 * Fitting a run of sampled points with as few cubics as hold it within a
 * tolerance, each held to the run's end tangents: the refit `simplifyPath`
 * and `warpPath` share.
 */
import { nearestOnCubic, nearestOnLine } from '../nearest';
import type { PenAnchor } from './anchors';
import { cubicPointAt, type Point } from './cubicMath';
import { fitCubicWithTangents } from './schneiderFit';

/** Most points a fitted cubic is checked at against the run it fits. */
const MAX_STRAY_STEPS = 512;

/** Give `to`, an anchor a refit kept where `from` was, `from`'s corner spec. */
export function keepCorner(to: PenAnchor, from: PenAnchor): void {
  if (from.corner) to.corner = { ...from.corner };
}

/**
 * Fit `pts` with cubics held to the end tangents, splitting at the worst
 * sample until every sample is within `tol`, and append the anchors after the
 * first to `out` (the first too when `out` is empty). `closing` folds the
 * final anchor, which lands on the subpath's first, into that first one.
 */
export function fitPointRun(pts: Point[], tStart: Point, tEnd: Point, tol: number, out: PenAnchor[], closing: boolean): void {
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
  const stray = worst.dist <= tol ? strayFromRun(pts, a, cp1, cp2, e, tol) : -1;
  if (worst.dist <= tol && stray < 0) {
    out.push({ c1: cp1, c2: cp2, end: e });
    return;
  }
  const k = stray < 0 ? worst.index : stray;
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

/**
 * Where the cubic strays more than `tol` from the polyline through `pts`
 * between the samples, as the interior sample to split the run at; -1 when it
 * never does. The samples hold the run to the cubic; this holds the cubic to
 * the run, which a cubic bulging across a sparsely sampled flat fails.
 */
function strayFromRun(pts: Point[], a: Point, c1: Point, c2: Point, e: Point, tol: number): number {
  const reach = Math.hypot(c1.x - a.x, c1.y - a.y) + Math.hypot(c2.x - c1.x, c2.y - c1.y) + Math.hypot(e.x - c2.x, e.y - c2.y);
  const steps = Math.min(MAX_STRAY_STEPS, Math.max(8, Math.ceil(reach / tol)));
  const edges = pts.length - 1;
  let hint = 0;
  for (let s = 1; s < steps; s++) {
    const p = cubicPointAt(a, c1, c2, e, s / steps);
    let near = -1;
    // Edges in order from the last one near the cubic, which it walks along.
    for (let j = 0; j < edges && near < 0; j++) {
      const i = (hint + j) % edges;
      if (nearestOnLine(p.x, p.y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y).dist <= tol) near = i;
    }
    if (near >= 0) { hint = near; continue; }
    // Split at whichever end of the edge it strayed from is nearer.
    const along = nearestOnLine(p.x, p.y, pts[hint].x, pts[hint].y, pts[hint + 1].x, pts[hint + 1].y).t;
    return Math.min(Math.max(hint + (along < 0.5 ? 0 : 1), 1), pts.length - 2);
  }
  return -1;
}

const sub2 = (p: Point, q: Point): Point => ({ x: p.x - q.x, y: p.y - q.y });
const neg = (p: Point): Point => ({ x: -p.x, y: -p.y });
function unit(p: Point): Point {
  const len = Math.hypot(p.x, p.y);
  return len === 0 ? { x: 0, y: 0 } : { x: p.x / len, y: p.y / len };
}
