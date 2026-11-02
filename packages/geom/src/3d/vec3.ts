/** Three-component vectors and unit quaternions. `Vec3`'s fields are readonly:
 *  a pose stored in a history snapshot must not be writable through the value
 *  handed to a renderer.
 *
 *  Named fields rather than a tuple, matching `Vec2` one tier up, so a
 *  consumer writing both dimensions says `p.x` in each. `Quat` stays a tuple —
 *  it is not a point, and `[x, y, z, w]` is the layout three.js and glMatrix
 *  both use. */

import { lerp as lerpScalar } from '../scalar';

/** A point or direction in 3D. */
export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** `[x, y, z, w]`, w last — the layout three.js and glMatrix both use. */
export type Quat = readonly [number, number, number, number];

/** `a + b`. */
export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

/** `a - b`. */
export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

/** `a` multiplied by the scalar `k`. */
export function scale(a: Vec3, k: number): Vec3 {
  return { x: a.x * k, y: a.y * k, z: a.z * k };
}

/** Dot product. */
export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** Cross product `a × b`. */
export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

/** Squared length. Compare distances with this and skip the square root. */
export function len2(a: Vec3): number {
  return dot(a, a);
}

/** Euclidean length. */
export function len(a: Vec3): number {
  return Math.sqrt(len2(a));
}

/** A vector with no length, or no finite one, normalizes to the zero vector
 *  rather than to `NaN`. Every other vector keeps its direction, however short. */
export function normalize(a: Vec3): Vec3 {
  const l = len(a);
  return l > 0 && l < Infinity ? scale(a, 1 / l) : { x: 0, y: 0, z: 0 };
}

/** Euclidean distance between two points. */
export function distance(a: Vec3, b: Vec3): number {
  return len(sub(a, b));
}

/** The point `t` of the way from `a` to `b`; `t` outside [0, 1] extrapolates. */
export function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: lerpScalar(a.x, b.x, t), y: lerpScalar(a.y, b.y, t), z: lerpScalar(a.z, b.z, t) };
}

/** `Vec3` from loose components — the shape `Mat4`'s row math produces. */
export function vec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

/** The quaternion for no rotation, `[0, 0, 0, 1]`. */
export function quatIdentity(): Quat {
  return [0, 0, 0, 1];
}

/** Rotation by `angle` radians about `axis`, which must be nonzero but need
 *  not be unit length. */
export function quatFromAxisAngle(axis: Vec3, angle: number): Quat {
  const a = normalize(axis);
  const half = angle / 2;
  const s = Math.sin(half);
  return [a.x * s, a.y * s, a.z * s, Math.cos(half)];
}

/** The rotation `a` after `b`: `quatRotate(quatMultiply(a, b), v)` is
 *  `quatRotate(a, quatRotate(b, v))`. */
export function quatMultiply(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

/** The inverse of a unit quaternion: the same rotation undone. */
export function quatConjugate(q: Quat): Quat {
  return [-q[0], -q[1], -q[2], q[3]];
}

/** `v` rotated by the unit quaternion `q`. */
export function quatRotate(q: Quat, v: Vec3): Vec3 {
  const [x, y, z, w] = q;
  const tx = 2 * (y * v.z - z * v.y);
  const ty = 2 * (z * v.x - x * v.z);
  const tz = 2 * (x * v.y - y * v.x);
  return {
    x: v.x + w * tx + (y * tz - z * ty),
    y: v.y + w * ty + (z * tx - x * tz),
    z: v.z + w * tz + (x * ty - y * tx),
  };
}
