/** Where two Bézier segments cross, by subdivision then Newton refinement. */

import type { Point } from '../paths/cubicMath';
import { evalSeg, derivSeg, type Seg } from '../booleans/contourSegments';

/** One crossing of segments `a` and `b`: the parameter on each, and the point. */
export interface SegmentCrossing {
  ta: number;
  tb: number;
  x: number;
  y: number;
}

/** Subdivision stops once both pieces are this flat (world units). */
const FLAT = 1e-4;
const MAX_DEPTH = 48;
/** Crossings closer than this along both parameters are one crossing. */
const SAME_T = 1e-7;
/** Two overlapping curves cross everywhere; stop collecting past this. */
const MAX_HITS = 16;

interface Piece {
  pts: Seg;
  t0: number;
  t1: number;
}

function boxOf(pts: Seg): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) {
    if (p.x < x0) x0 = p.x;
    if (p.x > x1) x1 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.y > y1) y1 = p.y;
  }
  return [x0, y0, x1, y1];
}

/** How far the control points stray from the chord. Zero for a line. */
function flatness(pts: Seg): number {
  if (pts.length === 2) return 0;
  const a = pts[0], b = pts[pts.length - 1];
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  let worst = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const d = len === 0 ? Math.hypot(p.x - a.x, p.y - a.y) : Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
    if (d > worst) worst = d;
  }
  return worst;
}

/** De Casteljau at one half, for a segment of any degree. */
function halve(p: Piece): [Piece, Piece] {
  let row = p.pts;
  const left: Point[] = [row[0]];
  const right: Point[] = [row[row.length - 1]];
  while (row.length > 1) {
    const next: Point[] = [];
    for (let i = 0; i + 1 < row.length; i++) {
      next.push({ x: (row[i].x + row[i + 1].x) / 2, y: (row[i].y + row[i + 1].y) / 2 });
    }
    row = next;
    left.push(row[0]);
    right.unshift(row[row.length - 1]);
  }
  const tm = (p.t0 + p.t1) / 2;
  return [{ pts: left, t0: p.t0, t1: tm }, { pts: right, t0: tm, t1: p.t1 }];
}

/** Where chords p0→p1 and q0→q1 cross, as parameters on each, or null when
 *  they are parallel or miss. `slack` widens [0, 1] on both. */
function chordCross(p0: Point, p1: Point, q0: Point, q1: Point, slack: number): [number, number] | null {
  const rx = p1.x - p0.x, ry = p1.y - p0.y;
  const sx = q1.x - q0.x, sy = q1.y - q0.y;
  const den = rx * sy - ry * sx;
  if (den === 0) return null;
  const qx = q0.x - p0.x, qy = q0.y - p0.y;
  const u = (qx * sy - qy * sx) / den;
  const v = (qx * ry - qy * rx) / den;
  if (u < -slack || u > 1 + slack || v < -slack || v > 1 + slack) return null;
  return [u, v];
}

/** Newton on A(ta) − B(tb) = 0, kept inside [0, 1]. */
function refine(a: Seg, b: Seg, ta: number, tb: number): [number, number] {
  for (let i = 0; i < 12; i++) {
    const pa = evalSeg(a, ta), pb = evalSeg(b, tb);
    const fx = pa.x - pb.x, fy = pa.y - pb.y;
    if (Math.abs(fx) + Math.abs(fy) < 1e-12) break;
    const da = derivSeg(a, ta), db = derivSeg(b, tb);
    // J = [da, -db]; solve J·[δa, δb] = −f.
    const det = -da.x * db.y + da.y * db.x;
    if (det === 0) break;
    const dta = (-fx * -db.y - -fy * -db.x) / det;
    const dtb = (da.x * -fy - da.y * -fx) / det;
    ta = Math.min(1, Math.max(0, ta + dta));
    tb = Math.min(1, Math.max(0, tb + dtb));
  }
  return [ta, tb];
}

/**
 * Every point where segment `a` crosses or touches segment `b` — each a line,
 * quadratic or cubic given by its control points — with the parameter on
 * each. Two lines are solved exactly; a curve is subdivided until its pieces
 * are flat, their chords crossed, and the answer refined against the curves.
 * Segments that overlap along a stretch report at most a few points of it.
 * Sorted by `ta`.
 */
export function intersectSegments(a: Point[], b: Point[]): SegmentCrossing[] {
  if (a.length === 2 && b.length === 2) {
    const uv = chordCross(a[0], a[1], b[0], b[1], 1e-12);
    if (!uv) return [];
    const ta = Math.min(1, Math.max(0, uv[0]));
    const tb = Math.min(1, Math.max(0, uv[1]));
    const p = evalSeg(a, ta);
    return [{ ta, tb, x: p.x, y: p.y }];
  }
  const out: SegmentCrossing[] = [];
  const push = (ta: number, tb: number) => {
    [ta, tb] = refine(a, b, ta, tb);
    const pa = evalSeg(a, ta), pb = evalSeg(b, tb);
    if (Math.hypot(pa.x - pb.x, pa.y - pb.y) > 1e-6 * (1 + Math.abs(pa.x) + Math.abs(pa.y))) return;
    if (out.some((h) => Math.abs(h.ta - ta) < SAME_T && Math.abs(h.tb - tb) < SAME_T)) return;
    out.push({ ta, tb, x: pa.x, y: pa.y });
  };
  const stack: Array<[Piece, Piece, number]> = [[{ pts: a, t0: 0, t1: 1 }, { pts: b, t0: 0, t1: 1 }, 0]];
  while (stack.length > 0 && out.length < MAX_HITS) {
    const [p, q, depth] = stack.pop()!;
    const bp = boxOf(p.pts), bq = boxOf(q.pts);
    if (bp[0] > bq[2] + FLAT || bq[0] > bp[2] + FLAT || bp[1] > bq[3] + FLAT || bq[1] > bp[3] + FLAT) continue;
    const fp = flatness(p.pts), fq = flatness(q.pts);
    if ((fp <= FLAT && fq <= FLAT) || depth >= MAX_DEPTH) {
      const uv = chordCross(p.pts[0], p.pts[p.pts.length - 1], q.pts[0], q.pts[q.pts.length - 1], 1e-6);
      if (uv) push(p.t0 + uv[0] * (p.t1 - p.t0), q.t0 + uv[1] * (q.t1 - q.t0));
      continue;
    }
    if (fp >= fq) {
      const [l, r] = halve(p);
      stack.push([l, q, depth + 1], [r, q, depth + 1]);
    } else {
      const [l, r] = halve(q);
      stack.push([p, l, depth + 1], [p, r, depth + 1]);
    }
  }
  return out.sort((h, k) => h.ta - k.ta);
}
