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

import { invert as invertAffine, type Mat3 as Affine } from '@weasel-js/geom';

export type GlMat3 = Float32Array;

function create(a: number, b: number, c: number, d: number, tx: number, ty: number): GlMat3 {
  // Column-major:
  //   col 0: (a, b, 0)
  //   col 1: (c, d, 0)
  //   col 2: (tx, ty, 1)
  return new Float32Array([a, b, 0, c, d, 0, tx, ty, 1]);
}

function identity(): GlMat3 {
  return create(1, 0, 0, 1, 0, 0);
}

function multiply(out: GlMat3, m: GlMat3): GlMat3 {
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

/** `m · T(tx, ty)`: composes onto `m`, where `@weasel-js/geom`'s `translate`
 *  constructs a fresh matrix. */
function translated(m: GlMat3, tx: number, ty: number): GlMat3 {
  const t = create(1, 0, 0, 1, tx, ty);
  return multiply(m, t);
}

/** `m · S(sx, sy)`: composes onto `m`, where geom's `scale` constructs one. */
function scaled(m: GlMat3, sx: number, sy: number): GlMat3 {
  const s = create(sx, 0, 0, sy, 0, 0);
  return multiply(m, s);
}

/** This layout read as the kernel's 6-element affine. The two carry the same
 *  logical order, so the conversion is a repack and nothing else — it exists
 *  so the repack has a name instead of appearing inline at each crossing. */
function toAffine(m: GlMat3): Affine {
  return [m[0], m[1], m[3], m[4], m[6], m[7]];
}

/** The kernel's affine in this layout. The inverse of {@link toAffine}, and
 *  what an `SvgGroupNode.transform` (also a kernel affine) becomes on its way
 *  to a `GroupDrawCommand`. */
function fromAffine(a: Affine): GlMat3 {
  return create(a[0], a[1], a[2], a[3], a[4], a[5]);
}

/** Inverse of an affine matrix, or `null` when `@weasel-js/geom`'s `invert`
 *  finds it singular — the same rule, read through this layout. */
function invert(m: GlMat3): GlMat3 | null {
  const inv = invertAffine(toAffine(m));
  return inv && fromAffine(inv);
}

function apply(m: GlMat3, x: number, y: number): [number, number] {
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
function screenToClip(width: number, height: number): GlMat3 {
  return create(
    2 / width,                       // a
    0,                               // b
    0,                               // c
    -2 / height,                     // d
    -1,                              // tx
    1,                               // ty
  );
}

/**
 * Uniform-equivalent scale factor: the square root of the absolute
 * determinant of the linear part, i.e. the geometric mean of the two axis
 * scales. Rotation-invariant. Under non-uniform scale it is between the two
 * axes and exact on neither — the same compromise `meanScale` documents.
 */
function meanScaleOf(m: GlMat3): number {
  return Math.sqrt(Math.abs(m[0] * m[4] - m[1] * m[3]));
}

/** The renderer's 3x3 matrix operations, as one namespace. These work on the
 *  9-element `Float32Array` form the GL uniform upload wants — distinct from
 *  `@weasel-js/geom`'s 6-element affine `GlMat3`, though the logical element
 *  order is the same. */
export const mat3 = {
  identity,
  toAffine,
  fromAffine,
  multiply,
  translated,
  scaled,
  invert,
  apply,
  screenToClip,
  meanScaleOf,
};
