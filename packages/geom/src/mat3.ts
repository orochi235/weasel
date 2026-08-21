/**
 * 2D affine transforms in canvas/DOMMatrix order: [a, b, c, d, e, f].
 *   x' = a·x + c·y + e
 *   y' = b·x + d·y + f
 * Represented as a 6-element number[] (f64). The affine tier of the kernel.
 *
 * Convention alignment: the renderer already has a `Mat3` in
 * `src/renderer/math/mat3.ts`. That one is a 9-element column-major
 * `Float32Array` (a full 3×3) shaped for `uniformMatrix3fv` — a deliberately
 * different *representation* for the WebGL upload path. Its *logical element
 * order* is identical to ours: `create(a, b, c, d, tx, ty)` maps
 * `x' = a·x + c·y + tx`, `y' = b·x + d·y + ty` (canvas/DOMMatrix a,b,c,d,e,f).
 * We keep the pure 6-tuple f64 form here (the kernel form); the 9-element f32
 * form stays a render-layer concern. No second logical convention is created.
 */
export type Mat3 = number[];

/** The transform that leaves a point where it is. */
export function identity(): Mat3 {
  return [1, 0, 0, 1, 0, 0];
}

/** A pure translation by `(tx, ty)`. */
export function translate(tx: number, ty: number): Mat3 {
  return [1, 0, 0, 1, tx, ty];
}

/** A pure scale about the origin. Scale about another point by composing
 *  translate → scale → inverse translate with `multiply`. */
export function scale(sx: number, sy: number): Mat3 {
  return [sx, 0, 0, sy, 0, 0];
}

/** A pure rotation about the origin, in radians, clockwise in canvas
 *  coordinates (y down). */
export function rotate(rad: number): Mat3 {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [c, s, -s, c, 0, 0];
}

/** Compose: result applies `n` first, then `m` (m·n). */
export function multiply(m: Mat3, n: Mat3): Mat3 {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

/** Inverse, or null when the matrix is singular (|det| below the epsilon). */
export function invert(m: Mat3): Mat3 | null {
  const det = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(det) < 1e-12) return null;
  const id = 1 / det;
  const a = m[3] * id;
  const b = -m[1] * id;
  const c = -m[2] * id;
  const d = m[0] * id;
  return [a, b, c, d, -(m[4] * a + m[5] * c), -(m[4] * b + m[5] * d)];
}

/** Apply to a point, returning a tuple. Cold-path use; hot loops inline. */
export function applyToPoint(m: Mat3, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** Affine that maps source box (sx,sy,sw,sh) onto destination box (dx,dy,dw,dh). */
export function boxToBox(
  sx: number, sy: number, sw: number, sh: number,
  dx: number, dy: number, dw: number, dh: number,
): Mat3 {
  const kx = sw === 0 ? 1 : dw / sw;
  const ky = sh === 0 ? 1 : dh / sh;
  // translate(dx,dy) · scale(kx,ky) · translate(-sx,-sy)
  return [kx, 0, 0, ky, dx - sx * kx, dy - sy * ky];
}

/** Rotation by `rad` about pivot (cx,cy): translate(c)·rotate·translate(-c). */
export function rotateAboutPoint(cx: number, cy: number, rad: number): Mat3 {
  return multiply(translate(cx, cy), multiply(rotate(rad), translate(-cx, -cy)));
}
