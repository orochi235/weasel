/**
 * Corner shapes as the CSS `corner-shape` property defines them: one curve,
 * `superellipse(k)`, whose keywords are points on its parameter. With
 * `n = 2^|k|`, a convex corner (`k > 0`) is the quarter of `|u|^n + |v|^n = 1`
 * spanned from the corner's center (the point across the cut from the outer
 * corner), and a concave one (`k < 0`) is the same curve spanned from the
 * outer corner instead, so `-k` mirrors `k` through the cut. `k = 1` is an
 * ellipse, `0` the straight bevel, and `±∞` the square corner and the notch.
 */
import { fitCubicWithTangents } from './schneiderFit';
import type { Point } from './cubicMath';
import { nearestOnCubic } from '../nearest';

/** The six `corner-shape` keywords, from most convex to most concave. */
export type CornerKeyword = 'square' | 'squircle' | 'round' | 'bevel' | 'scoop' | 'notch';

/** A corner's shape: a keyword, or a finite `superellipse()` parameter. */
export type CornerShape = CornerKeyword | number;

/** The keywords in the order cycling through them steps. */
export const CORNER_KEYWORDS: readonly CornerKeyword[] = ['square', 'squircle', 'round', 'bevel', 'scoop', 'notch'];

const K_OF: Record<CornerKeyword, number> = {
  square: Infinity, squircle: 2, round: 1, bevel: 0, scoop: -1, notch: -Infinity,
};

/** The `superellipse()` parameter of `shape`. */
export function cornerShapeK(shape: CornerShape): number {
  return typeof shape === 'number' ? shape : K_OF[shape];
}

/** The keyword whose parameter is exactly `k`, or null. */
export function cornerKeywordOf(k: number): CornerKeyword | null {
  return CORNER_KEYWORDS.find((w) => K_OF[w] === k) ?? null;
}

/** Whether `v` is a keyword or a finite number. */
export function isCornerShape(v: unknown): v is CornerShape {
  return (typeof v === 'number' && Number.isFinite(v)) || CORNER_KEYWORDS.includes(v as CornerKeyword);
}

/** The keyword after `shape` in {@link CORNER_KEYWORDS}, wrapping; from a
 *  number, the first keyword less convex than it. */
export function nextCornerShape(shape: CornerShape): CornerKeyword {
  if (typeof shape !== 'number') {
    return CORNER_KEYWORDS[(CORNER_KEYWORDS.indexOf(shape) + 1) % CORNER_KEYWORDS.length];
  }
  return CORNER_KEYWORDS.find((w) => K_OF[w] < shape) ?? CORNER_KEYWORDS[0];
}

/** Largest distance, in units of the corner's setback, the fitted cubics may
 *  stray from the true superellipse. */
export const CORNER_FIT_TOLERANCE = 1e-3;

/** The cut a corner shape spans: from `start` to `end`, the two points where
 *  it leaves the edges, around `outer`, the corner the edges meet at. */
export interface CornerShapeFrame {
  start: Point;
  end: Point;
  outer: Point;
}

/** One piece of a corner's outline, continuing from where the last ended. */
export type CornerPiece =
  | { kind: 'line'; to: Point }
  | { kind: 'cubic'; c1: Point; c2: Point; to: Point };

/** Kappa of the cubic quarter circle, the one the kit draws every arc with. */
const KAPPA = (4 / 3) * Math.tan(Math.PI / 8);

/** The exponent `2^|k|`, or Infinity once the curve is a right angle within
 *  the fit tolerance. */
function exponentOf(k: number): number {
  const n = 2 ** Math.abs(k);
  return 1 - 0.5 ** (1 / n) < CORNER_FIT_TOLERANCE / 4 ? Infinity : n;
}

/** The point at `theta` on the unit curve `u^n + v^n = 1`: `π/2` is
 *  `(0, 1)`, where the corner starts, and `0` is `(1, 0)`, where it ends. */
function unitPoint(n: number, theta: number): Point {
  const p = 2 / n;
  return { x: Math.cos(theta) ** p, y: Math.sin(theta) ** p };
}

/** The point `w` of the way along the unit curve, from 0 at `(0, 1)` to 2 at
 *  `(1, 0)`: `u` steps evenly out to the diagonal, then `v` steps evenly back.
 *  The fit runs on this rather than `theta`, which crowds a large `n`'s legs
 *  into less angle than a double can resolve. */
function curveAt(n: number, w: number): Point {
  const d = 0.5 ** (1 / n);
  const across = (c: number) => Math.max(0, 1 - c ** n) ** (1 / n);
  if (w <= 1) { const u = w * d; return { x: u, y: across(u) }; }
  const v = (2 - w) * d;
  return { x: across(v), y: v };
}

/** The unit direction of travel from start to end at `w`. */
function curveTangent(n: number, w: number): Point {
  const p = curveAt(n, w);
  // The coordinate nearer zero over the other is at most 1, so the power cannot overflow.
  const [x, y] = w <= 1 ? [1, -((p.x / p.y) ** (n - 1))] : [(p.y / p.x) ** (n - 1), -1];
  const l = Math.hypot(x, y);
  return { x: x / l, y: y / l };
}

type UnitCubic = [Point, Point, Point];

const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });

/** Points of the true curve each piece is checked at before the worst is refined. */
const FIT_CHECKS = 32;

/** The farthest any point of the true curve between `a` and `b` lies from
 *  the cubic `p0, c1, c2, p3`: the worst of evenly spaced checks, then
 *  searched between its neighbors, since a sharp corner's peak falls between. */
function fitError(n: number, a: number, b: number, p0: Point, [c1, c2, p3]: UnitCubic): number {
  const off = (w: number) => {
    const q = curveAt(n, w);
    return nearestOnCubic(q.x, q.y, p0.x, p0.y, c1.x, c1.y, c2.x, c2.y, p3.x, p3.y).dist;
  };
  let worst = 0, at = 1;
  for (let i = 1; i < FIT_CHECKS; i++) {
    const d = off(a + (b - a) * (i / FIT_CHECKS));
    if (d > worst) { worst = d; at = i; }
  }
  let lo = a + (b - a) * ((at - 1) / FIT_CHECKS), hi = a + (b - a) * ((at + 1) / FIT_CHECKS);
  for (let i = 0; i < 24; i++) {
    const l = lo + (hi - lo) / 3, r = hi - (hi - lo) / 3;
    if (off(l) > off(r)) hi = r; else lo = l;
  }
  return Math.max(worst, off((lo + hi) / 2));
}

/** Cubics through the unit curve from `w = a` to `b`, split until each is
 *  within `tol`. */
function fitUnit(n: number, a: number, b: number, tol: number, depth: number, out: UnitCubic[]): void {
  const p0 = curveAt(n, a), p3 = curveAt(n, b);
  const samples: Point[] = [];
  const params: number[] = [];
  for (let i = 0; i <= 12; i++) {
    samples.push(curveAt(n, a + (b - a) * (i / 12)));
    params.push(i / 12);
  }
  const tEnd = curveTangent(n, b);
  const { cp1, cp2 } = fitCubicWithTangents(samples, curveTangent(n, a), { x: -tEnd.x, y: -tEnd.y }, { params });
  const piece: UnitCubic = [cp1, cp2, p3];
  if (depth >= 10 || fitError(n, a, b, p0, piece) <= tol) { out.push(piece); return; }
  const mid = (a + b) / 2;
  fitUnit(n, a, mid, tol, depth + 1, out);
  fitUnit(n, mid, b, tol, depth + 1, out);
}

const unitCache = new Map<string, UnitCubic[]>();

/** The unit curve of exponent `n` as cubics, `(0, 1)` to `(1, 0)`. */
function unitCubics(n: number, tol: number): UnitCubic[] {
  if (n === 2) return [[{ x: KAPPA, y: 1 }, { x: 1, y: KAPPA }, { x: 1, y: 0 }]];
  const key = `${n}:${tol}`;
  let hit = unitCache.get(key);
  if (!hit) {
    hit = [];
    fitUnit(n, 0, 2, tol, 0, hit);
    if (unitCache.size > 256) unitCache.clear();
    unitCache.set(key, hit);
  }
  return hit;
}

/** `frame` mapped from the unit square spanned at `center`. */
function mapperFor(frame: CornerShapeFrame, center: Point): (p: Point) => Point {
  const ex = sub(frame.end, center), sy = sub(frame.start, center);
  return (p) => ({ x: center.x + p.x * ex.x + p.y * sy.x, y: center.y + p.x * ex.y + p.y * sy.y });
}

/** The center the convex curves are spanned from: across the cut from `outer`. */
export function cornerCenter(frame: CornerShapeFrame): Point {
  return { x: frame.start.x + frame.end.x - frame.outer.x, y: frame.start.y + frame.end.y - frame.outer.y };
}

/**
 * The outline of a corner of parameter `k` across `frame`, from its start to
 * its end. Exact at `k = 0` (a line), `±1` (the cubic quarter arc the kit
 * draws circles with) and `±∞` (two lines, through the outer corner or the
 * center); fitted with cubics within `tolerance` of the setback elsewhere.
 */
export function cornerShapePieces(k: number, frame: CornerShapeFrame, tolerance = CORNER_FIT_TOLERANCE): CornerPiece[] {
  if (k === 0) return [{ kind: 'line', to: frame.end }];
  const n = exponentOf(k);
  if (n === Infinity) {
    const via = k > 0 ? frame.outer : cornerCenter(frame);
    return [{ kind: 'line', to: via }, { kind: 'line', to: frame.end }];
  }
  const map = mapperFor(frame, k > 0 ? cornerCenter(frame) : frame.outer);
  return unitCubics(n, tolerance).map(([c1, c2, to]) => ({ kind: 'cubic', c1: map(c1), c2: map(c2), to: map(to) }));
}

/** The point on the true curve of parameter `k` across `frame` at `s`, from
 *  0 at its start to 1 at its end. Finite `k` only. */
export function cornerShapePoint(k: number, frame: CornerShapeFrame, s: number): Point {
  const n = 2 ** Math.abs(k);
  const map = mapperFor(frame, k > 0 ? cornerCenter(frame) : frame.outer);
  return map(unitPoint(n, (Math.PI / 2) * (1 - s)));
}
