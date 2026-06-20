/**
 * Scalar / 2-vector primitives and the kernel-wide epsilon policy.
 *
 * Points are scalar pairs (px, py); there is no point struct. All math is
 * f64 (JS-native). Epsilons are f32-SCALE and magnitude-relative, because
 * stored coords are quantized to Float32 (~7 significant digits) — see the
 * geometry-kernel spec.
 */

/** Base relative epsilon, sized for Float32 storage (~1 part in 1e-6). */
export const EPS = 1e-6;

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
 * absolute difference is within EPS scaled by the larger magnitude. This is
 * the ONLY equality the kernel uses on computed coordinates — never `===`,
 * never an f64-tight literal.
 */
export function approxEq(a: number, b: number, eps: number = EPS): boolean {
  const diff = Math.abs(a - b);
  if (diff === 0) return true;
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return diff <= eps * scale;
}
