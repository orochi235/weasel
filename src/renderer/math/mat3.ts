/**
 * 2D affine matrix utilities. Column-major 9-element Float32Array, matching
 * `WebGL2RenderingContext.uniformMatrix3fv` byte order so we can pass the
 * array directly without a transpose flag.
 *
 * Layout (column-major):
 *   [m00, m10, 0,
 *    m01, m11, 0,
 *    tx,  ty,  1]
 *
 * `apply(m, x, y)` returns `[m * (x, y, 1)] = [m00*x + m01*y + tx,
 *                                              m10*x + m11*y + ty]`.
 */

export type Mat3 = Float32Array;

function create(a: number, b: number, c: number, d: number, tx: number, ty: number): Mat3 {
  // Column-major:
  //   col 0: (a, b, 0)
  //   col 1: (c, d, 0)
  //   col 2: (tx, ty, 1)
  return new Float32Array([a, b, 0, c, d, 0, tx, ty, 1]);
}

function identity(): Mat3 {
  return create(1, 0, 0, 1, 0, 0);
}

function multiply(out: Mat3, m: Mat3): Mat3 {
  // out := out · m  (right-multiply by m).
  const a = out[0], b = out[1];
  const c = out[3], d = out[4];
  const tx = out[6], ty = out[7];
  const ma = m[0], mb = m[1];
  const mc = m[3], md = m[4];
  const mtx = m[6], mty = m[7];

  return create(
    a * ma + c * mb,                 // new a
    b * ma + d * mb,                 // new b
    a * mc + c * md,                 // new c
    b * mc + d * md,                 // new d
    a * mtx + c * mty + tx,          // new tx
    b * mtx + d * mty + ty,          // new ty
  );
}

function translate(m: Mat3, tx: number, ty: number): Mat3 {
  const t = create(1, 0, 0, 1, tx, ty);
  return multiply(m, t);
}

function scale(m: Mat3, sx: number, sy: number): Mat3 {
  const s = create(sx, 0, 0, sy, 0, 0);
  return multiply(m, s);
}

function apply(m: Mat3, x: number, y: number): [number, number] {
  const a = m[0], b = m[1];
  const c = m[3], d = m[4];
  const tx = m[6], ty = m[7];
  return [a * x + c * y + tx, b * x + d * y + ty];
}

/**
 * Map screen pixel coords (0..width on X, 0..height on Y, top-left origin)
 * into clip space (-1..1 on X, 1..-1 on Y — note Y flip so screen-down
 * matches clip-down).
 */
function screenToClip(width: number, height: number): Mat3 {
  return create(
    2 / width,                       // a
    0,                               // b
    0,                               // c
    -2 / height,                     // d
    -1,                              // tx
    1,                               // ty
  );
}

export const mat3 = {
  identity,
  multiply,
  translate,
  scale,
  apply,
  screenToClip,
};
