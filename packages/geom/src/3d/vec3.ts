/** Three-component vectors and unit quaternions. Immutable tuples throughout:
 *  a pose stored in a history snapshot must not be writable through the value
 *  handed to a renderer. */

export type Vec3 = readonly [number, number, number];
/** `[x, y, z, w]`, w last — the layout three.js and glMatrix both use. */
export type Quat = readonly [number, number, number, number];

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
  return l > 0 && l < Infinity ? scale(a, 1 / l) : [0, 0, 0];
}

export function quatIdentity(): Quat {
  return [0, 0, 0, 1];
}

export function quatFromAxisAngle(axis: Vec3, angle: number): Quat {
  const a = normalize(axis);
  const half = angle / 2;
  const s = Math.sin(half);
  return [a[0] * s, a[1] * s, a[2] * s, Math.cos(half)];
}
