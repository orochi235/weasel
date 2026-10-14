/**
 * 2D affine transforms in canvas/DOMMatrix order: [a, b, c, d, e, f].
 *   x' = a·x + c·y + e
 *   y' = b·x + d·y + f
 * Represented as a readonly 6-tuple (f64). The affine tier of the kernel.
 *
 * `glMat3.ts` beside this file holds the renderer's matrix: a 9-element
 * column-major array (a full 3×3) laid out for `uniformMatrix3fv`. Its
 * *logical element order* is identical to ours.
 */
import { SINGULAR_RATIO } from './scalar';

/** `[a, b, c, d, e, f]`: `x' = a·x + c·y + e`, `y' = b·x + d·y + f`. */
export type Affine = readonly [number, number, number, number, number, number];

/** The transform that leaves a point where it is. */
export function identity(): Affine {
  return [1, 0, 0, 1, 0, 0];
}

/** A pure translation by `(tx, ty)`. */
export function translate(tx: number, ty: number): Affine {
  return [1, 0, 0, 1, tx, ty];
}

/** A pure scale about the origin. Scale about another point by composing
 *  translate → scale → inverse translate with `multiply`. */
export function scale(sx: number, sy: number): Affine {
  return [sx, 0, 0, sy, 0, 0];
}

/** A pure rotation about the origin, in radians, clockwise in canvas
 *  coordinates (y down). */
export function rotate(rad: number): Affine {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [c, s, -s, c, 0, 0];
}

/** Compose: result applies `n` first, then `m` (m·n). */
export function multiply(m: Affine, n: Affine): Affine {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

/** Inverse, or null when the matrix is singular, non-finite, or too
 *  ill-conditioned to invert meaningfully at its own scale. */
export function invert(m: Affine): Affine | null {
  const det = m[0] * m[3] - m[1] * m[2];
  // The determinant is an area, so it is judged against the squared column norms.
  const norm2 = Math.max(m[0] * m[0] + m[1] * m[1], m[2] * m[2] + m[3] * m[3]);
  // Negated so a non-finite determinant falls out as singular.
  if (!(Math.abs(det) > SINGULAR_RATIO * norm2)) return null;
  const id = 1 / det;
  const a = m[3] * id;
  const b = -m[1] * id;
  const c = -m[2] * id;
  const d = m[0] * id;
  return [a, b, c, d, -(m[4] * a + m[5] * c), -(m[4] * b + m[5] * d)];
}

/** Apply to a point, returning a tuple. Cold-path use; hot loops inline. */
export function applyToPoint(m: Affine, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** Affine that maps source box (sx,sy,sw,sh) onto destination box (dx,dy,dw,dh). */
export function boxToBox(
  sx: number, sy: number, sw: number, sh: number,
  dx: number, dy: number, dw: number, dh: number,
): Affine {
  const kx = sw === 0 ? 1 : dw / sw;
  const ky = sh === 0 ? 1 : dh / sh;
  // translate(dx,dy) · scale(kx,ky) · translate(-sx,-sy)
  return [kx, 0, 0, ky, dx - sx * kx, dy - sy * ky];
}

/** Rotation by `rad` about pivot (cx,cy): translate(c)·rotate·translate(-c). */
export function rotateAboutPoint(cx: number, cy: number, rad: number): Affine {
  return multiply(translate(cx, cy), multiply(rotate(rad), translate(-cx, -cy)));
}

/**
 * Apply an affine to an interleaved coord stream, returning a fresh f64
 * buffer. Command codes are unaffected — for a Bezier the transformed control
 * points define the transformed curve exactly (affine invariance), so callers
 * pass `path.coords` straight through and keep `path.commands` as-is.
 */
export function transformCoords(coords: ArrayLike<number>, m: Affine): Float64Array {
  const out = new Float64Array(coords.length);
  const a = m[0], b = m[1], c = m[2], d = m[3], e = m[4], f = m[5];
  for (let i = 0; i + 1 < coords.length; i += 2) {
    const x = coords[i], y = coords[i + 1];
    out[i] = a * x + c * y + e;
    out[i + 1] = b * x + d * y + f;
  }
  return out;
}
