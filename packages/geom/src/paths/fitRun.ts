/**
 * Fitting a run of sampled points with as few cubics as hold it within a
 * tolerance, each held to the run's end tangents: the refit `simplifyPath`
 * and `warpPath` share.
 */
import { nearestOnLine } from '../nearest';
import type { PenAnchor } from './anchors';
import type { Point } from './cubicMath';
import { cubicWithin, packRun, searchHandles } from './fitHandles';
import { fitCubicWithTangents } from './schneiderFit';

/** Give `to`, an anchor a refit kept where `from` was, `from`'s corner spec. */
export function keepCorner(to: PenAnchor, from: PenAnchor): void {
  if (from.corner) to.corner = { ...from.corner };
}

/**
 * Fit `pts` with cubics held to the end tangents, each the longest stretch one
 * cubic holds within `tol`, and append the anchors after the first to `out`
 * (the first too when `out` is empty). `closing` folds the final anchor,
 * which lands on the subpath's first, into that first one.
 */
export function fitPointRun(pts: Point[], tStart: Point, tEnd: Point, tol: number, out: PenAnchor[], closing: boolean): void {
  if (out.length === 0) out.push({ x: pts[0].x, y: pts[0].y });
  const segs: Seg[] = [];
  fitGreedy(pts, tStart, tEnd, tol, segs);
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

type Seg = { c1?: Point; c2?: Point; end: Point };

/**
 * Each piece is the longest prefix of what is left that one cubic holds,
 * found by bisecting on its end sample. Splitting at the worst sample instead
 * cuts where a poor first fit strays most, which is rarely where a piece has
 * to end: it refit a puppet-warped bar with twice the anchors it needed.
 */
function fitGreedy(pts: Point[], tStart: Point, tEnd: Point, tol: number, out: Seg[]): void {
  let from = 0;
  let tIn = tStart;
  for (;;) {
    const whole = fitOne(pts.slice(from), tIn, tEnd, tol);
    if (whole) { out.push(whole); return; }
    let lo = from + 1, hi = pts.length - 1;
    let piece: Seg = { end: pts[lo] };
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      const fit = fitOne(pts.slice(from, mid + 1), tIn, neg(tangentAt(pts, mid)), tol);
      if (fit) { lo = mid; piece = fit; } else hi = mid;
    }
    out.push(piece);
    tIn = tangentAt(pts, lo);
    from = lo;
  }
}

const tangentAt = (pts: Point[], k: number): Point => unit(sub2(pts[k + 1], pts[k - 1]));

/** One cubic held to the run's end tangents within `tol` of the run both ways, or null. */
function fitOne(pts: Point[], tStart: Point, tEnd: Point, tol: number): Seg | null {
  const a = pts[0];
  const e = pts[pts.length - 1];
  if (pts.length <= 2 || withinLine(pts, a, e, tol)) return { end: e };
  const run = packRun(pts);
  const { cp1, cp2 } = fitCubicWithTangents(pts, tStart, tEnd);
  if (cubicWithin(run, a, cp1, cp2, e, tol)) return { c1: cp1, c2: cp2, end: e };
  const found = searchHandles(run, a, e, tStart, tEnd, tol, { cp1, cp2 });
  return found && cubicWithin(run, a, found.cp1, found.cp2, e, tol) ? { c1: found.cp1, c2: found.cp2, end: e } : null;
}

function withinLine(pts: Point[], a: Point, e: Point, tol: number): boolean {
  for (let i = 1; i < pts.length - 1; i++) {
    if (nearestOnLine(pts[i].x, pts[i].y, a.x, a.y, e.x, e.y).dist > tol) return false;
  }
  return true;
}

const sub2 = (p: Point, q: Point): Point => ({ x: p.x - q.x, y: p.y - q.y });
const neg = (p: Point): Point => ({ x: -p.x, y: -p.y });
function unit(p: Point): Point {
  const len = Math.hypot(p.x, p.y);
  return len === 0 ? { x: 0, y: 0 } : { x: p.x / len, y: p.y / len };
}
