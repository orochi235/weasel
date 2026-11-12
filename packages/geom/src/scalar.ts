/**
 * Scalar / 2-vector primitives and the kernel-wide epsilon policy.
 *
 * Points are scalar pairs (px, py); there is no point struct. All math is
 * f64 (JS-native). Epsilons are f32-SCALE and magnitude-relative, because
 * stored coords are quantized to Float32 (~7 significant digits).
 */

/** Base relative epsilon, sized for Float32 storage (~1 part in 1e-6). */
export const EPS = 1e-6;

/** The reciprocal of the largest condition number a matrix may have and still invert, and the fraction of a
 *  quantity's own scale below which it counts as zero. Dimensionless, so a uniformly tiny matrix still inverts
 *  while a large one whose determinant is only rounding does not. */
export const SINGULAR_RATIO = 1e-12;

/** Whether a matrix whose 1-norm is `norm`, and its inverse's `inverseNorm`, is well enough conditioned to
 *  invert: their product, the matrix's condition number, stays under `1 / SINGULAR_RATIO`. Both `invert`s use
 *  it, so 2D and 3D refuse the same matrices. `NaN` and `Infinity` count as refused. */
export function invertible(norm: number, inverseNorm: number): boolean {
  return norm * inverseNorm < 1 / SINGULAR_RATIO;
}

/** `v` held to `lo`..`hi`. `lo` wins when the bounds cross; `NaN` passes through. */
export function clamp(v: number, lo: number, hi: number): number {
  const c = v > hi ? hi : v;
  return c < lo ? lo : c;
}

/** `v` held to `0`..`1`; `NaN` passes through. */
export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** `n` rounded to `places` decimals and written as JavaScript writes it, for a number in a file: SVG path data,
 *  an attribute. A non-finite `n` writes `'0'`. */
export function trimNumber(n: number, places = 6): string {
  if (!Number.isFinite(n)) return '0';
  const k = 10 ** places;
  const rounded = Math.round(n * k) / k;
  // Past about 1e302, `n * k` overflows; a number that large has no decimals to round.
  return String(Number.isFinite(rounded) ? rounded : n);
}

/** The number `t` of the way from `a` to `b`; `t` outside [0, 1] extrapolates. Exactly `b` at `t = 1`, which
 *  `a + (b - a) * t` can miss by an ulp, and finite where `b - a` would overflow. */
export function lerp(a: number, b: number, t: number): number {
  if (t === 1) return b;
  if (a === b) return a;
  const d = b - a;
  return Number.isFinite(d) ? a + d * t : a * (1 - t) + b * t;
}

/** 2D cross (wedge) product of vectors (ax,ay) and (bx,by). */
export function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

/** Whether directions (rx,ry) and (sx,sy) are parallel to within rounding: their cross product is under
 *  `SINGULAR_RATIO` of the product of their lengths. A zero vector is parallel to every direction. Points rounded
 *  onto one line leave a cross product of noise, which divides to an arbitrary crossing. */
export function nearlyParallel(rx: number, ry: number, sx: number, sy: number): boolean {
  return !(Math.abs(rx * sy - ry * sx) > SINGULAR_RATIO * Math.hypot(rx, ry) * Math.hypot(sx, sy));
}

/** 2D dot product. */
export function dot(ax: number, ay: number, bx: number, by: number): number {
  return ax * bx + ay * by;
}

/** Component difference (ax-bx, ay-by) as a tuple. Cold-path use only. */
export function sub(ax: number, ay: number, bx: number, by: number): [number, number] {
  return [ax - bx, ay - by];
}

/** Squared length of (x,y). Avoids the sqrt; compare against squared thresholds. */
export function len2(x: number, y: number): number {
  return x * x + y * y;
}

/** Three-valued sign. */
export function sign(n: number): -1 | 0 | 1 {
  return n > 0 ? 1 : n < 0 ? -1 : 0;
}

/**
 * Magnitude-scaled approximate equality. Two values are equal when their
 * absolute difference is within EPS scaled by the larger magnitude. Every
 * comparison of two *computed coordinates* goes through this — never `===`,
 * never an f64-tight literal.
 *
 * The exception is a guard against an exact algebraic value that a formula
 * produces bit-for-bit: a homogeneous `w === 1`, a ray's `d === 0`. Those are
 * testing a branch, not comparing coordinates. Widening one to `approxEq`
 * would change which branch runs, not how precisely it runs.
 */
export function approxEq(a: number, b: number, eps: number = EPS): boolean {
  if (a === b) return true;   // also the only way two infinities compare equal
  const diff = Math.abs(a - b);
  // Infinity/Infinity is 1, so an unguarded relative test calls every finite
  // number equal to an infinity.
  if (!Number.isFinite(diff)) return false;
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return diff <= eps * scale;
}

/**
 * The least of `values`, or with `of`, the least `of(item, index)` over `items` without building the mapped
 * array. Answers as `Math.min(...values)` does, `Infinity` for none and `NaN` if any is `NaN`, but reads them
 * in a loop: a spread passes every value as an argument, and past about 125,000 of them throws a `RangeError`.
 */
export function minOf(values: Iterable<number>): number;
export function minOf<T>(items: Iterable<T>, of: (item: T, index: number) => number): number;
export function minOf<T>(items: Iterable<T>, of?: (item: T, index: number) => number): number {
  let least = Infinity;
  let i = 0;
  for (const item of items) least = Math.min(least, of ? of(item, i++) : (item as number));
  return least;
}

/** The greatest of `values`, or of `of(item, index)` over `items`: {@link minOf}'s twin, answering as
 *  `Math.max(...values)` does (`-Infinity` for none, `NaN` if any is `NaN`) without spreading them. */
export function maxOf(values: Iterable<number>): number;
export function maxOf<T>(items: Iterable<T>, of: (item: T, index: number) => number): number;
export function maxOf<T>(items: Iterable<T>, of?: (item: T, index: number) => number): number {
  let most = -Infinity;
  let i = 0;
  for (const item of items) most = Math.max(most, of ? of(item, i++) : (item as number));
  return most;
}
