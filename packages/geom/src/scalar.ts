/**
 * Scalar / 2-vector primitives and the kernel-wide epsilon policy.
 *
 * Points are scalar pairs (px, py); there is no point struct. All math is
 * f64 (JS-native). Epsilons are f32-SCALE and magnitude-relative, because
 * stored coords are quantized to Float32 (~7 significant digits).
 */

/** Base relative epsilon, sized for Float32 storage (~1 part in 1e-6). */
export const EPS = 1e-6;

/** A determinant at or below this fraction of its matrix's own scale counts as
 *  singular. Dimensionless, so a uniformly tiny matrix still inverts while a
 *  large one whose determinant is only rounding does not. */
export const SINGULAR_RATIO = 1e-12;

/** `v` held to `lo`..`hi`. `lo` wins when the bounds cross; `NaN` passes through. */
export function clamp(v: number, lo: number, hi: number): number {
  const c = v > hi ? hi : v;
  return c < lo ? lo : c;
}

/** `v` held to `0`..`1`; `NaN` passes through. */
export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** The number `t` of the way from `a` to `b`; `t` outside [0, 1] extrapolates. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 2D cross (wedge) product of vectors (ax,ay) and (bx,by). */
export function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
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
