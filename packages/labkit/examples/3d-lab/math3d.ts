/**
 * The 3D math the lab needs and nothing more: vectors, quaternions, 4x4
 * matrices in GL's column-major order, and the four intersection/projection
 * routines the picking deps are built from.
 *
 * Kept free of weasel and of WebGL so every claim in the lab's findings rests
 * on something the suite can run — there is no GL in vitest.
 */

export type Vec3 = readonly [number, number, number];
/** `[x, y, z, w]`. */
export type Quat = readonly [number, number, number, number];
/** 16 numbers, column-major: element (row `r`, column `c`) is `m[c * 4 + r]`. */
export type Mat4 = readonly number[];

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Ray {
  origin: Vec3;
  direction: Vec3;
}

export interface ScreenBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const EPSILON = 1e-9;

export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function scale(a: Vec3, k: number): Vec3 {
  return [a[0] * k, a[1] * k, a[2] * k];
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function length(a: Vec3): number {
  return Math.sqrt(dot(a, a));
}

export function normalize(a: Vec3): Vec3 {
  const len = length(a);
  return len < EPSILON ? [0, 0, 0] : scale(a, 1 / len);
}

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

export function transformPoint(m: Mat4, p: Vec3): Vec3 {
  const [x, y, z, w] = transformPoint4(m, p);
  if (Math.abs(w) < EPSILON || w === 1) return [x, y, z];
  return [x / w, y / w, z / w];
}

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
  if (Math.abs(det) < EPSILON) return null;
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

export function quatFromAxisAngle(axis: Vec3, angle: number): Quat {
  const a = normalize(axis);
  const half = angle / 2;
  const s = Math.sin(half);
  return [a[0] * s, a[1] * s, a[2] * s, Math.cos(half)];
}

export function quatIdentity(): Quat {
  return [0, 0, 0, 1];
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

export function lookAt(eye: Vec3, target: Vec3, up: Vec3): Mat4 {
  const back = normalize(sub(eye, target));
  const right = normalize(cross(up, back));
  const trueUp = cross(back, right);
  return [
    right[0], trueUp[0], back[0], 0,
    right[1], trueUp[1], back[1], 0,
    right[2], trueUp[2], back[2], 0,
    -dot(right, eye), -dot(trueUp, eye), -dot(back, eye), 1,
  ];
}

/** Screen point (y down, rect-relative) to normalized device coordinates (y up). */
export function screenToNdc(point: { x: number; y: number }, rect: Rect): { x: number; y: number } {
  return {
    x: ((point.x - rect.x) / rect.w) * 2 - 1,
    y: 1 - ((point.y - rect.y) / rect.h) * 2,
  };
}

export function ndcToScreen(ndc: { x: number; y: number }, rect: Rect): { x: number; y: number } {
  return {
    x: rect.x + (ndc.x * 0.5 + 0.5) * rect.w,
    y: rect.y + (1 - (ndc.y * 0.5 + 0.5)) * rect.h,
  };
}

/**
 * The ray a screen point names, given the camera that drew the rect. This is
 * the whole of what 3D picking needs from a pointer — which is why the lab
 * leaves the dispatcher's world point at two numbers.
 */
export function rayThroughScreenPoint(
  point: { x: number; y: number },
  rect: Rect,
  viewProjection: Mat4,
  eye: Vec3,
): Ray {
  const inv = invert(viewProjection);
  if (!inv) return { origin: eye, direction: [0, 0, -1] };
  const ndc = screenToNdc(point, rect);
  const near = transformPoint(inv, [ndc.x, ndc.y, -1]);
  const far = transformPoint(inv, [ndc.x, ndc.y, 1]);
  return { origin: eye, direction: normalize(sub(far, near)) };
}

/** Distance along the ray to the box, or null. A ray starting inside returns 0. */
export function intersectRayAabb(ray: Ray, min: Vec3, max: Vec3): number | null {
  let tMin = Number.NEGATIVE_INFINITY;
  let tMax = Number.POSITIVE_INFINITY;

  for (let axis = 0; axis < 3; axis++) {
    const o = ray.origin[axis];
    const d = ray.direction[axis];
    if (Math.abs(d) < EPSILON) {
      if (o < min[axis] || o > max[axis]) return null;
      continue;
    }
    let t1 = (min[axis] - o) / d;
    let t2 = (max[axis] - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    if (t1 > tMin) tMin = t1;
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return null;
  }

  if (tMax < 0) return null;
  return tMin < 0 ? 0 : tMin;
}

/** Plane is `dot(normal, p) === offset`. */
export function intersectRayPlane(ray: Ray, normal: Vec3, offset: number): number | null {
  const denom = dot(normal, ray.direction);
  if (Math.abs(denom) < EPSILON) return null;
  const t = (offset - dot(normal, ray.origin)) / denom;
  return t < 0 ? null : t;
}

/**
 * The screen rectangle a world-space box covers — the currency weasel's chrome
 * and `PoseDescriptor.getBounds` speak in.
 *
 * Corners behind the camera are dropped rather than clipped, so a box straddling
 * the near plane reports a box that is too small. Good enough for chrome on a
 * lab's handful of solids; not good enough to promote.
 */
export function projectAabbToScreen(
  min: Vec3,
  max: Vec3,
  viewProjection: Mat4,
  rect: Rect,
): ScreenBox | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let any = false;

  for (let i = 0; i < 8; i++) {
    const corner: Vec3 = [
      i & 1 ? max[0] : min[0],
      i & 2 ? max[1] : min[1],
      i & 4 ? max[2] : min[2],
    ];
    const [cx, cy, , cw] = transformPoint4(viewProjection, corner);
    if (cw <= EPSILON) continue;
    const screen = ndcToScreen({ x: cx / cw, y: cy / cw }, rect);
    minX = Math.min(minX, screen.x);
    minY = Math.min(minY, screen.y);
    maxX = Math.max(maxX, screen.x);
    maxY = Math.max(maxY, screen.y);
    any = true;
  }

  if (!any) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
