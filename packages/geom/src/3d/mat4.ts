/** 4x4 matrices in GL's column-major order: element (row `r`, column `c`) is
 *  `m[c * 4 + r]`, which is the layout `gl.uniformMatrix4fv` reads without a
 *  transpose and the one three.js `toArray()` emits. */

import { SINGULAR_RATIO } from '../scalar';
import { cross, dot, len, normalize, sub, type Quat, type Vec3 } from './vec3';

/** 16 numbers, column-major. */
export type Mat4 = readonly number[];

export function identity(): Mat4 {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

export function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Array<number>(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = sum;
    }
  }
  return out;
}

/** `[x, y, z, w]` in whatever space `m` maps into — clip space, when `m` is a view-projection. */
export function transformPoint4(
  m: Mat4,
  p: Vec3,
): readonly [number, number, number, number] {
  const [x, y, z] = p;
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
    m[3] * x + m[7] * y + m[11] * z + m[15],
  ];
}

/** `transformPoint4` divided through by w, however small. A point on the eye
 *  plane (w = 0) comes back non-finite. */
export function transformPoint(m: Mat4, p: Vec3): Vec3 {
  const [x, y, z, w] = transformPoint4(m, p);
  if (w === 1) return [x, y, z];
  return [x / w, y / w, z / w];
}

/** Inverse, or null when the matrix is singular, non-finite, or too
 *  ill-conditioned to invert meaningfully at its own scale. */
export function invert(m: Mat4): Mat4 | null {
  const [
    m00, m01, m02, m03,
    m10, m11, m12, m13,
    m20, m21, m22, m23,
    m30, m31, m32, m33,
  ] = m;

  const b00 = m00 * m11 - m01 * m10;
  const b01 = m00 * m12 - m02 * m10;
  const b02 = m00 * m13 - m03 * m10;
  const b03 = m01 * m12 - m02 * m11;
  const b04 = m01 * m13 - m03 * m11;
  const b05 = m02 * m13 - m03 * m12;
  const b06 = m20 * m31 - m21 * m30;
  const b07 = m20 * m32 - m22 * m30;
  const b08 = m20 * m33 - m23 * m30;
  const b09 = m21 * m32 - m22 * m31;
  const b10 = m21 * m33 - m23 * m31;
  const b11 = m22 * m33 - m23 * m32;

  const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  // Hadamard: |det| never exceeds the product of the column lengths, so the
  // ratio is a volume in [0, 1] that no per-column scale can shrink.
  const scale =
    Math.sqrt(m00 * m00 + m01 * m01 + m02 * m02 + m03 * m03) *
    Math.sqrt(m10 * m10 + m11 * m11 + m12 * m12 + m13 * m13) *
    Math.sqrt(m20 * m20 + m21 * m21 + m22 * m22 + m23 * m23) *
    Math.sqrt(m30 * m30 + m31 * m31 + m32 * m32 + m33 * m33);
  // Negated so a non-finite determinant falls out as singular.
  if (!(Math.abs(det) > SINGULAR_RATIO * scale)) return null;
  const d = 1 / det;

  return [
    (m11 * b11 - m12 * b10 + m13 * b09) * d,
    (m02 * b10 - m01 * b11 - m03 * b09) * d,
    (m31 * b05 - m32 * b04 + m33 * b03) * d,
    (m22 * b04 - m21 * b05 - m23 * b03) * d,
    (m12 * b08 - m10 * b11 - m13 * b07) * d,
    (m00 * b11 - m02 * b08 + m03 * b07) * d,
    (m32 * b02 - m30 * b05 - m33 * b01) * d,
    (m20 * b05 - m22 * b02 + m23 * b01) * d,
    (m10 * b10 - m11 * b08 + m13 * b06) * d,
    (m01 * b08 - m00 * b10 - m03 * b06) * d,
    (m30 * b04 - m31 * b02 + m33 * b00) * d,
    (m21 * b02 - m20 * b04 - m23 * b00) * d,
    (m11 * b07 - m10 * b09 - m12 * b06) * d,
    (m00 * b09 - m01 * b07 + m02 * b06) * d,
    (m31 * b01 - m30 * b03 - m32 * b00) * d,
    (m20 * b03 - m21 * b01 + m22 * b00) * d,
  ];
}

export function compose(position: Vec3, rotation: Quat, scaling: Vec3): Mat4 {
  const [x, y, z, w] = rotation;
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;
  const [sx, sy, sz] = scaling;

  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    position[0], position[1], position[2], 1,
  ];
}

export function perspective(fovY: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovY / 2);
  const range = near - far;
  return [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) / range, -1,
    0, 0, (2 * far * near) / range, 0,
  ];
}

/** A view from `eye` toward `target`. With the eye on its target, or `up`
 *  parallel to the view to within rounding, the view has no orientation and
 *  the result is singular. */
export function lookAt(eye: Vec3, target: Vec3, up: Vec3): Mat4 {
  const back = normalize(sub(eye, target));
  const side = cross(up, back);
  // |side| is |up| times the sine of the angle between up and the view.
  const right = len(side) > SINGULAR_RATIO * len(up) ? normalize(side) : ([0, 0, 0] as const);
  const trueUp = cross(back, right);
  return [
    right[0], trueUp[0], back[0], 0,
    right[1], trueUp[1], back[1], 0,
    right[2], trueUp[2], back[2], 0,
    -dot(right, eye), -dot(trueUp, eye), -dot(back, eye), 1,
  ];
}
