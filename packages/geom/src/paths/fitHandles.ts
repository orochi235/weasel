/**
 * How far a cubic and a run of samples stray from each other, and the handle
 * lengths that bring them closest: the measure and the search behind
 * `fitPointRun`. Both work on flattened cubics and on the run as a polyline.
 */
import type { Point } from './cubicMath';

/** A cubic's two handles. */
export interface Handles {
  cp1: Point;
  cp2: Point;
}

/** Handle lengths tried on each axis of the coarse search, as shares of the chord. */
const GRID = [0.02, 0.1, 0.2, 0.3, 0.45, 0.6, 0.8, 1.05];
/** Most steps of the pattern search after the coarse one. */
const MAX_STEPS = 60;
/** Segments the cubic is flattened to while the search compares handle lengths. */
const SEARCH_FLAT = 48;
/** The search stops once the run and the cubic are within this share of the tolerance. */
const TARGET = 0.9;
/** A least-squares fit farther than this many tolerances from the run is not searched around. */
const SEARCH_REACH = 4;
/** A coarse best farther than this many tolerances is not worth refining. */
const GIVE_UP = 2;
/** How far a flattened cubic may sit from the cubic, as a share of the tolerance, when checking a fit. */
const CHECK_SAG = 1 / 16;
const MAX_CHECK_FLAT = 512;

/** `pts` as interleaved `x, y`. */
export function packRun(pts: readonly Point[]): Float64Array {
  const run = new Float64Array(2 * pts.length);
  pts.forEach((p, i) => { run[2 * i] = p.x; run[2 * i + 1] = p.y; });
  return run;
}

/**
 * Whether the cubic from `a` to `e` lies within `tol` of the polyline through
 * `run`, and every sample of `run` within `tol` of it. The samples hold the
 * run to the cubic; the other way holds the cubic to the run, which a cubic
 * bulging across a sparsely sampled flat fails. The cubic is flattened finely
 * enough that its chords stay within a sixteenth of `tol` of it, and that
 * much is taken off the bound.
 */
export function cubicWithin(run: Float64Array, a: Point, cp1: Point, cp2: Point, e: Point, tol: number): boolean {
  // A chord of a cubic split N ways sits within max|B''| / 8N² of it, and |B''| is at most 6 × the larger second difference.
  const bend = 6 * Math.max(Math.hypot(a.x - 2 * cp1.x + cp2.x, a.y - 2 * cp1.y + cp2.y), Math.hypot(cp1.x - 2 * cp2.x + e.x, cp1.y - 2 * cp2.y + e.y));
  const n = Math.min(MAX_CHECK_FLAT, Math.max(8, Math.ceil(Math.sqrt(bend / (8 * CHECK_SAG * tol)))));
  const sag = bend / (8 * n * n);
  const bound = tol - sag;
  if (bound <= 0) return false;
  const flat = new Float64Array(2 * (n + 1));
  flatten(a, cp1, cp2, e, flat);
  return worstFromPolyline(run, flat, bound) <= bound && worstFromPolyline(flat, run, bound) <= bound;
}

/**
 * The handle lengths, directions held, that bring the run nearest the cubic
 * both ways: a coarse grid, then a pattern search from its best; null when
 * even the best of the grid is far off. Least squares minimizes the sum, so
 * its worst sample can sit well outside a tolerance other lengths meet, often
 * in another basin entirely: a bend near one end wants that end's handle
 * short. The caller checks the result with {@link cubicWithin}.
 */
export function searchHandles(run: Float64Array, a: Point, e: Point, tStart: Point, tEnd: Point, tol: number, from: Handles): Handles | null {
  const chord = Math.hypot(e.x - a.x, e.y - a.y);
  const at = (al: number, be: number): Handles => ({
    cp1: { x: a.x + al * tStart.x, y: a.y + al * tStart.y },
    cp2: { x: e.x + be * tEnd.x, y: e.y + be * tEnd.y },
  });
  const flat = new Float64Array(2 * (SEARCH_FLAT + 1));
  /** How far apart the run and the cubic get, or some figure above `bound` once they pass it. */
  const spread = (al: number, be: number, bound: number) => {
    const { cp1, cp2 } = at(al, be);
    flatten(a, cp1, cp2, e, flat);
    const out = worstFromPolyline(run, flat, bound);
    return out > bound ? out : Math.max(out, worstFromPolyline(flat, run, bound));
  };
  const fromAl = Math.max(0, (from.cp1.x - a.x) * tStart.x + (from.cp1.y - a.y) * tStart.y);
  const fromBe = Math.max(0, (from.cp2.x - e.x) * tEnd.x + (from.cp2.y - e.y) * tEnd.y);
  let al = fromAl, be = fromBe, best = spread(al, be, Infinity);
  if (best > SEARCH_REACH * tol) return null;
  for (const fa of GRID) for (const fb of GRID) {
    const d = spread(fa * chord, fb * chord, best);
    if (d < best) { best = d; al = fa * chord; be = fb * chord; }
  }
  if (best > GIVE_UP * tol) return null;
  let step = chord * 0.05;
  for (let i = 0; i < MAX_STEPS && best > TARGET * tol && step > tol / 32; i++) {
    let moved = false;
    for (const [da, db] of STEPS) {
      const na = al + da * step, nb = be + db * step;
      if (na < 0 || nb < 0) continue;
      const d = spread(na, nb, best);
      if (d < best) { best = d; al = na; be = nb; moved = true; break; }
    }
    if (!moved) step /= 2;
  }
  return at(al, be);
}

const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];

/** The cubic at even parameters, as many as `out` holds points, into `out`. */
function flatten(a: Point, cp1: Point, cp2: Point, e: Point, out: Float64Array): void {
  const n = out.length / 2 - 1;
  const ax = e.x - a.x + 3 * (cp1.x - cp2.x), ay = e.y - a.y + 3 * (cp1.y - cp2.y);
  const bx = 3 * (a.x - 2 * cp1.x + cp2.x), by = 3 * (a.y - 2 * cp1.y + cp2.y);
  const cx = 3 * (cp1.x - a.x), cy = 3 * (cp1.y - a.y);
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    out[2 * k] = ((ax * t + bx) * t + cx) * t + a.x;
    out[2 * k + 1] = ((ay * t + by) * t + cy) * t + a.y;
  }
}

/**
 * The farthest any interior point of `from` lies from the polyline through
 * `to`, both interleaved `x, y` and running the same way; it stops early,
 * with a figure above `bound`, once one is farther than that. Each point
 * looks only a stretch ahead of where the last one landed, so a polyline
 * doubling back reads as farther than it is, never nearer.
 */
function worstFromPolyline(from: Float64Array, to: Float64Array, bound: number): number {
  const edges = to.length / 2 - 1;
  const reach = Math.max(4, edges >> 2);
  const limit = bound * bound;
  let hint = 0, worst = 0;
  for (let i = 2; i < from.length - 2; i += 2) {
    const px = from[i], py = from[i + 1];
    let near = Infinity, at = hint;
    for (let j = hint, end = Math.min(edges, hint + reach); j < end; j++) {
      const x0 = to[2 * j], y0 = to[2 * j + 1];
      const dx = to[2 * j + 2] - x0, dy = to[2 * j + 3] - y0;
      const len = dx * dx + dy * dy;
      const s = len === 0 ? 0 : Math.min(1, Math.max(0, ((px - x0) * dx + (py - y0) * dy) / len));
      const ex = x0 + s * dx - px, ey = y0 + s * dy - py;
      const d = ex * ex + ey * ey;
      if (d < near) { near = d; at = j; }
    }
    hint = at;
    if (near > worst) {
      worst = near;
      if (worst > limit) break;
    }
  }
  return Math.sqrt(worst);
}
