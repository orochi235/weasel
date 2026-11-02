/** Measuring one Bézier segment by arc length, and finding where a run of it ends. */

const GL_X = [-0.9602898564975363, -0.7966664774136267, -0.5255324099163290, -0.1834346424956498,
  0.1834346424956498, 0.5255324099163290, 0.7966664774136267, 0.9602898564975363];
const GL_W = [0.1012285362903763, 0.2223810344533745, 0.3137066458778873, 0.3626837833783620,
  0.3626837833783620, 0.3137066458778873, 0.2223810344533745, 0.1012285362903763];

const G4_X = [-0.8611363115940526, -0.3399810435848563, 0.3399810435848563, 0.8611363115940526];
const G4_W = [0.3478548451374538, 0.6521451548625461, 0.6521451548625461, 0.3478548451374538];

/** How far the eight-point rule may sit from the four-point one on a panel, as a share of the
 *  segment's size, before the panel is refined. */
const PANEL_AGREE = 1e-9;
/** A derivative root is a cusp or a dip in speed when the dip is narrower than this many panel
 *  widths: its speed over the curvature of its path there, `|B′| / |B″|`, a width in `t`. */
const DIP_PANELS = 1;
/** A dip this share of a panel from its edge marks the panel across the edge too: its shoulder
 *  sits in the gap before the edge's nearest Gauss node. */
const EDGE_NEAR = 0.05;
/** How closely a refined panel's halves must agree, as a share of the segment's size. */
const SETTLE = 1e-13;

/** The speed of the segment at `t`: the length of its derivative. */
function speed(c: ArrayLike<number>, dim: number, t: number): number {
  const n = c.length / dim - 1;
  const u = 1 - t;
  let sum = 0;
  for (let k = 0; k < dim; k++) {
    const d0 = c[dim + k] - c[k];
    const v = n === 1 ? d0
      : n === 2 ? 2 * (u * d0 + t * (c[2 * dim + k] - c[dim + k]))
        : 3 * (u * u * d0 + 2 * u * t * (c[2 * dim + k] - c[dim + k]) + t * t * (c[3 * dim + k] - c[2 * dim + k]));
    sum += v * v;
  }
  return Math.sqrt(sum);
}

function rule(c: ArrayLike<number>, dim: number, a: number, b: number, xs: readonly number[], ws: readonly number[]): number {
  const mid = (a + b) / 2, half = (b - a) / 2;
  let sum = 0;
  for (let i = 0; i < xs.length; i++) sum += ws[i] * speed(c, dim, mid + xs[i] * half);
  return sum * half;
}

/** `whole`, the eight-point length over `a..b`, refined by halves until they agree within `tol`.
 *  A difference that is not a number counts as settled. */
function refined(c: ArrayLike<number>, dim: number, a: number, b: number, whole: number, tol: number, depth: number): number {
  const m = (a + b) / 2;
  const l = rule(c, dim, a, m, GL_X, GL_W), r = rule(c, dim, m, b, GL_X, GL_W);
  if (depth >= 20 || !(Math.abs(l + r - whole) > tol)) return l + r;
  return refined(c, dim, a, m, l, tol, depth + 1) + refined(c, dim, m, b, r, tol, depth + 1);
}

/** The length of the control polygon: the segment's own size, which tolerances scale by. */
function hullLength(c: ArrayLike<number>, dim: number): number {
  let sum = 0;
  for (let i = dim; i < c.length; i += dim) {
    let d2 = 0;
    for (let k = 0; k < dim; k++) d2 += (c[i + k] - c[i - dim + k]) ** 2;
    sum += Math.sqrt(d2);
  }
  return sum;
}

function finite(c: ArrayLike<number>): boolean {
  for (let i = 0; i < c.length; i++) if (!Number.isFinite(c[i])) return false;
  return true;
}

/** Where a component of the segment's derivative is zero, strictly inside `a..b`, ascending:
 *  the only places a cusp or a dip in speed can sit, which an error estimate can step over. */
function derivativeRoots(c: ArrayLike<number>, dim: number, a: number, b: number): number[] {
  const n = c.length / dim - 1;
  const out: number[] = [];
  const keep = (t: number) => { if (t > a && t < b) out.push(t); };
  for (let k = 0; k < dim; k++) {
    const d0 = c[dim + k] - c[k];
    const d1 = c[2 * dim + k] - c[dim + k];
    if (n === 2) {
      if (d0 !== d1) keep(d0 / (d0 - d1));
      continue;
    }
    // Bernstein (d0, d1, d2) as A t² + B t + C.
    const d2 = c[3 * dim + k] - c[2 * dim + k];
    const A = d0 - 2 * d1 + d2, B = 2 * (d1 - d0), C = d0;
    if (Math.abs(A) <= 1e-12 * (Math.abs(B) + Math.abs(C))) {
      if (B !== 0) keep(-C / B);
      continue;
    }
    const disc = B * B - 4 * A * C;
    if (disc < 0) continue;
    // The stable pair: one root from the sum that cannot cancel, the other from the product.
    const q = -(B + Math.sign(B || 1) * Math.sqrt(disc)) / 2;
    keep(q / A);
    if (q !== 0) keep(C / q);
  }
  out.sort((x, y) => x - y);
  return out.filter((t, i) => i === 0 || t !== out[i - 1]);
}

/** The eight-point length over `p0..p1`, refined when it sits beside a slow root or its
 *  four-point rule disagrees. */
function panelLength(c: ArrayLike<number>, dim: number, p0: number, p1: number, size: number, beside: boolean): number {
  if (!(p1 > p0)) return 0;
  const g8 = rule(c, dim, p0, p1, GL_X, GL_W);
  const settled = !beside && !(Math.abs(g8 - rule(c, dim, p0, p1, G4_X, G4_W)) > PANEL_AGREE * size);
  return settled ? g8 : refined(c, dim, p0, p1, g8, SETTLE * size, 0);
}

/**
 * Length of a Bézier segment between parameters `a` and `b`, by Gauss–Legendre
 * over eight panels, split where a component of its derivative is zero and
 * the speed dips there within a panel's width. The panels beside such a root
 * are halved until they settle, and so is any other where the eight- and
 * four-point rules disagree. `coords` holds its control
 * points flat, `dim` components each: two points for a line, three for a
 * quadratic, four for a cubic. NaN when a coordinate is not finite.
 */
export function segmentLength(coords: ArrayLike<number>, dim: 2 | 3, a = 0, b = 1): number {
  if (!finite(coords)) return NaN;
  if (coords.length === 2 * dim) return speed(coords, dim, 0) * (b - a);
  const size = hullLength(coords, dim);
  return lengthOver(coords, dim, a, b, size, speedDips(coords, dim));
}

/** The length of the segment's second derivative at `t`. */
function bend(c: ArrayLike<number>, dim: number, t: number): number {
  const n = c.length / dim - 1;
  let sum = 0;
  for (let k = 0; k < dim; k++) {
    const e0 = c[2 * dim + k] - 2 * c[dim + k] + c[k];
    const v = n === 2 ? 2 * e0 : 6 * ((1 - t) * e0 + t * (c[3 * dim + k] - 2 * c[2 * dim + k] + c[dim + k]));
    sum += v * v;
  }
  return Math.sqrt(sum);
}

/** A derivative root inside 0..1, and how wide its dip in speed is, in `t`. */
interface Dip { t: number; width: number }

/** @internal The derivative roots inside 0..1, each with the width of its dip. */
export function speedDips(c: ArrayLike<number>, dim: number): Dip[] {
  return derivativeRoots(c, dim, 0, 1).map((t) => {
    const b = bend(c, dim, t);
    return { t, width: b > 0 ? speed(c, dim, t) / b : Infinity };
  });
}

/** @internal The dips a panel `h` wide cannot be trusted to see: narrower than {@link DIP_PANELS} panels. */
export function dipsFor(dips: readonly Dip[], h: number): number[] {
  const out: number[] = [];
  for (const d of dips) if (d.width < DIP_PANELS * h) out.push(d.t);
  return out;
}

/** {@link segmentLength} over `a..b` in `panels` panels, given the segment's size and its dips. */
function lengthOver(
  c: ArrayLike<number>, dim: number, a: number, b: number, size: number, dips: readonly Dip[], panels = 8,
): number {
  const h = (b - a) / panels;
  const last = panels - 1;
  let sum = 0;
  const roots = dipsFor(dips, h);
  if (roots.length === 0) {
    for (let k = 0; k < panels; k++) sum += panelLength(c, dim, a + k * h, k === last ? b : a + (k + 1) * h, size, false);
    return sum;
  }
  const near = (t: number): boolean => roots.some((r) => Math.abs(r - t) <= EDGE_NEAR * h);
  let r = 0;
  while (r < roots.length && roots[r] <= a) r++;
  for (let k = 0; k < panels; k++) {
    const p0 = a + k * h, p1 = k === last ? b : p0 + h;
    let from = p0;
    // A dip splits its panel, and every piece that touches one, or comes near, is refined.
    while (r < roots.length && roots[r] < p1) {
      sum += panelLength(c, dim, from, roots[r], size, true);
      from = roots[r++];
    }
    sum += panelLength(c, dim, from, p1, size, near(from) || near(p1));
  }
  return sum;
}

/**
 * The parameter at which the segment {@link segmentLength} reads has run
 * `length` from its start, clamped to 0..1: Newton steps on the arc length,
 * held inside a shrinking bracket. `total` is its whole length, when the
 * caller has it; it is trusted, not checked, and a wrong one misplaces the
 * clamp and the first guess. 0 when a coordinate is not finite, as for a
 * segment of no length.
 */
export function segmentTAtLength(
  coords: ArrayLike<number>, dim: 2 | 3, length: number, total = segmentLength(coords, dim),
): number {
  if (length <= 0 || !(total > 0) || !Number.isFinite(total)) return 0;
  if (length >= total) return 1;
  if (coords.length === 2 * dim) return length / total;
  const size = hullLength(coords, dim);
  const dips = speedDips(coords, dim);
  let lo = 0, hi = 1, t = length / total;
  for (let i = 0; i < 30; i++) {
    const err = lengthOver(coords, dim, 0, t, size, dips) - length;
    if (Math.abs(err) < 1e-10 * total) break;
    if (err > 0) hi = t; else lo = t;
    const v = speed(coords, dim, t);
    let next = v > 0 ? t - err / v : NaN;
    if (!(next > lo && next < hi)) next = (lo + hi) / 2;
    t = next;
  }
  return t;
}

const STEPS = 16;

/** A curved segment's exact arc length at evenly spaced parameters: what repeated length queries on one segment start from. */
export interface ArcLookup {
  /** The length from the start to parameter `k / 16`, `k` = 0..16. */
  readonly s: Float64Array;
  readonly size: number;
  readonly dips: readonly Dip[];
}

/** @internal The {@link ArcLookup} of curved segment `coords`, each step measured as one panel of {@link segmentLength}'s rule. */
export function arcLookup(coords: ArrayLike<number>, dim: 2 | 3): ArcLookup {
  const size = hullLength(coords, dim);
  const dips = finite(coords) ? speedDips(coords, dim) : [];
  const s = new Float64Array(STEPS + 1);
  for (let k = 0; k < STEPS; k++) s[k + 1] = s[k] + lengthOver(coords, dim, k / STEPS, (k + 1) / STEPS, size, dips, 1);
  return { s, size, dips };
}

/** @internal The length from the start of `coords` to parameter `t`, read from its lookup `lk`. */
export function lookupLength(coords: ArrayLike<number>, dim: 2 | 3, lk: ArcLookup, t: number): number {
  const f = Math.min(Math.max(t, 0), 1);
  const k = Math.min(Math.floor(f * STEPS), STEPS - 1);
  return lk.s[k] + lengthOver(coords, dim, k / STEPS, f, lk.size, lk.dips, 1);
}

/**
 * @internal {@link segmentTAtLength} from a lookup: the step holding `length`
 * gives the first guess and the bracket, and Newton steps on one panel's
 * length finish it, so a query costs a few panels rather than a whole-segment solve.
 */
export function lookupT(coords: ArrayLike<number>, dim: 2 | 3, lk: ArcLookup, length: number): number {
  const { s } = lk;
  const total = s[STEPS];
  if (length <= 0 || !(total > 0) || !Number.isFinite(total)) return 0;
  if (length >= total) return 1;
  let k = 0;
  let hi = STEPS - 1;
  while (k < hi) {
    const mid = (k + hi + 1) >> 1;
    if (s[mid] <= length) k = mid;
    else hi = mid - 1;
  }
  const a = k / STEPS;
  let lo = a, top = (k + 1) / STEPS;
  const step = s[k + 1] - s[k];
  let t = step > 0 ? a + ((length - s[k]) / step) / STEPS : a;
  for (let i = 0; i < 30; i++) {
    const err = s[k] + lengthOver(coords, dim, a, t, lk.size, lk.dips, 1) - length;
    if (Math.abs(err) < 1e-10 * total) break;
    if (err > 0) top = t; else lo = t;
    const v = speed(coords, dim, t);
    let next = v > 0 ? t - err / v : NaN;
    if (!(next > lo && next < top)) next = (lo + top) / 2;
    t = next;
  }
  return t;
}

/** `pts` as the flat 2D coords {@link segmentLength} reads. */
export const flatPoints = (pts: readonly { x: number; y: number }[]): number[] => pts.flatMap((p) => [p.x, p.y]);
