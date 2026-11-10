import type { PolygonPath } from '../path';
import { anchorsToPath, pathToAnchors, type PenAnchor } from './anchors';
import { cubicPointAt, type Point } from './cubicMath';
import { fitPointRun, keepCorner } from './fitRun';
import { DEG_TO_RAD } from '../angle';

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
  const { anchors, closed } = pathToAnchors(path);
  const out: PenAnchor[][] = [];
  const outClosed: boolean[] = [];
  anchors.forEach((sub, s) => {
    if (sub.length < 2) return;
    out.push(simplifySubpath(sub, closed[s], tolerance, opts));
    outClosed.push(closed[s]);
  });
  return anchorsToPath(out, outClosed, path);
}

/** One subpath of {@link simplifyPath}: its anchors refitted, corners and
 *  open ends kept. */
export function simplifySubpath(
  sub: PenAnchor[],
  closed: boolean,
  tolerance: number,
  opts: SimplifyPathOptions = {},
): PenAnchor[] {
  const { tol, cosCorner } = fitParams(tolerance, opts);
  const n = sub.length;
  const corners = [...breaksOf(sub, closed, cosCorner, tol)].sort((a, b) => a - b);
  const result: PenAnchor[] = [];
  if (closed && corners.length === 0) {
    const pts = sampleRun(sub, 0, n, tol);
    const t = unit(sub2(pts[1], pts[pts.length - 2]));
    fitPointRun(pts, t, neg(t), tol, result, true);
    keepCorner(result[0], sub[0]);
    return result;
  }
  fitStops(sub, closed ? [...corners, corners[0] + n] : corners, tol, result, closed);
  return result;
}

/**
 * The anchors of `sub` from index `from` to `to`, refitted the way
 * {@link simplifyPath} refits a subpath: as few as hold the span within
 * `tolerance`, corners inside it kept. Indices run modulo the subpath's
 * length, so on a closed subpath `to` may pass its end and wrap; the span is
 * shorter than one full turn. The two end anchors stay where they are and
 * keep their handles facing out of the span. Answers the anchors from `from`
 * to `to`, both included, to splice in place of the originals.
 */
export function simplifySpan(
  sub: PenAnchor[],
  closed: boolean,
  from: number,
  to: number,
  tolerance: number,
  opts: SimplifyPathOptions = {},
): PenAnchor[] {
  const { tol, cosCorner } = fitParams(tolerance, opts);
  const n = sub.length;
  const breaks = breaksOf(sub, closed, cosCorner, tol);
  const stops = [from];
  for (let k = from + 1; k < to; k++) if (breaks.has(k % n)) stops.push(k);
  stops.push(to);
  const first = sub[from % n];
  const result: PenAnchor[] = [{ x: first.x, y: first.y, ...(first.inHandle ? { inHandle: { ...first.inHandle } } : {}) }];
  keepCorner(result[0], first);
  fitStops(sub, stops, tol, result, false);
  const lastOut = sub[to % n].outHandle;
  if (lastOut) result[result.length - 1].outHandle = { ...lastOut };
  return result;
}

function fitParams(tolerance: number, opts: SimplifyPathOptions): { tol: number; cosCorner: number } {
  return {
    tol: Math.max(tolerance, 1e-6),
    cosCorner: Math.cos((opts.cornerAngle ?? 40) * DEG_TO_RAD),
  };
}

/** The anchors a refit must keep: corners, and both ends of a long straight. */
function breaksOf(sub: PenAnchor[], closed: boolean, cosCorner: number, tol: number): Set<number> {
  const n = sub.length;
  const breaks = new Set<number>();
  for (let i = 0; i < n; i++) if (isCorner(sub, i, closed, cosCorner)) breaks.add(i);
  for (const [from, to] of longStraights(sub, closed, tol)) {
    breaks.add(from);
    breaks.add(to);
  }
  return breaks;
}

/** Fit each run between consecutive `stops` and append it to `out`. With
 *  `closing`, the last run ends on the subpath's first anchor. */
function fitStops(sub: PenAnchor[], stops: readonly number[], tol: number, out: PenAnchor[], closing: boolean): void {
  const n = sub.length;
  for (let k = 0; k + 1 < stops.length; k++) {
    const pts = sampleRun(sub, stops[k], stops[k + 1], tol);
    // Coincident anchors sample to a single point, which has no run to fit.
    if (pts.length < 2) continue;
    const last = closing && k + 2 === stops.length;
    const fresh = out.length === 0;
    fitPointRun(pts, unit(sub2(pts[1], pts[0])), unit(sub2(pts[pts.length - 2], pts[pts.length - 1])), tol, out, last);
    if (fresh) keepCorner(out[0], sub[stops[k] % n]);
    if (!last) keepCorner(out[out.length - 1], sub[stops[k + 1] % n]);
  }
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

/**
 * The straights far longer than the segments either side, as the anchors they
 * run between: flats between curves, kept whole rather than folded into a
 * curve fitted across them. Straight segments that carry on in one line within
 * `tol` count as one straight, so a flat drawn in several pieces is measured
 * whole and its inner anchors are not kept.
 */
function longStraights(sub: PenAnchor[], closed: boolean, tol: number): [number, number][] {
  const n = sub.length;
  const segs = closed ? n : n - 1;
  const has = (k: number): boolean => closed || (k >= 0 && k < segs);
  const len = (k: number): number => {
    if (!has(k)) return 0;
    const a = sub[(k + n) % n];
    const b = sub[(k + 1) % n];
    return Math.hypot(b.x - a.x, b.y - a.y);
  };
  const straight = (k: number): boolean => has(k) && !sub[(k + n) % n].outHandle && !sub[(k + 1) % n].inHandle;
  /** Whether segment `k` carries on segment `k - 1`'s line. */
  const continues = (k: number): boolean => {
    if (!straight(k) || !straight(k - 1)) return false;
    const a = sub[(k - 1 + n) % n], m = sub[k % n], b = sub[(k + 1) % n];
    const dx = b.x - a.x, dy = b.y - a.y;
    const span = Math.hypot(dx, dy);
    if (span === 0 || (m.x - a.x) * dx + (m.y - a.y) * dy <= 0 || (b.x - m.x) * dx + (b.y - m.y) * dy <= 0) return false;
    return Math.abs((m.x - a.x) * dy - (m.y - a.y) * dx) / span <= tol;
  };
  const out: [number, number][] = [];
  for (let s = 0; s < segs; s++) {
    if (!straight(s) || continues(s)) continue;
    let e = s, total = len(s);
    while (e + 1 - s < segs && continues(e + 1)) total += len(++e);
    if (total >= LONG_STRAIGHT * Math.max(len(s - 1), len(e + 1))) out.push([s, (e + 1) % n]);
  }
  return out;
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
