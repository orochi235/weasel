/** Three-component vectors and unit quaternions. `Vec3`'s fields are readonly:
 *  a pose stored in a history snapshot must not be writable through the value
 *  handed to a renderer.
 *
 *  Named fields rather than a tuple, matching `Vec2` one tier up, so a
 *  consumer writing both dimensions says `p.x` in each. `Quat` stays a tuple —
 *  it is not a point, and `[x, y, z, w]` is the layout three.js and glMatrix
 *  both use. */

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** `[x, y, z, w]`, w last — the layout three.js and glMatrix both use. */
export type Quat = readonly [number, number, number, number];

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale(a: Vec3, k: number): Vec3 {
  return { x: a.x * k, y: a.y * k, z: a.z * k };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

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

export function len(a: Vec3): number {
  return Math.sqrt(len2(a));
}

/** A vector with no length, or no finite one, normalizes to the zero vector
 *  rather than to `NaN`. Every other vector keeps its direction, however short. */
export function normalize(a: Vec3): Vec3 {
  const l = len(a);
  return l > 0 && l < Infinity ? scale(a, 1 / l) : { x: 0, y: 0, z: 0 };
}

/** `Vec3` from loose components — the shape `Mat4`'s row math produces. */
export function vec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

export function quatIdentity(): Quat {
  return [0, 0, 0, 1];
}

export function quatFromAxisAngle(axis: Vec3, angle: number): Quat {
  const a = normalize(axis);
  const half = angle / 2;
  const s = Math.sin(half);
  return [a.x * s, a.y * s, a.z * s, Math.cos(half)];
}
