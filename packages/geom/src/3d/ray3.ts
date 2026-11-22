/** Rays, axis-aligned boxes, and the intersections picking is built from. */

import { nearestPointOnSegment as nearestPointOnSegmentN, squaresHeld } from '../points';
import { SINGULAR_RATIO } from '../scalar';
import { add, dot, len, len2, scale, sub, type Vec3 } from './vec3';
import { transformPoint, type Mat4 } from './mat4';

/** A ray from `origin` along `direction`, which need not be unit length: the
 *  `t` the intersections return is in multiples of it. */
export interface Ray {
  origin: Vec3;
  direction: Vec3;
}

/** An axis-aligned box. `min` is componentwise <= `max`. */
export interface Aabb {
  min: Vec3;
  max: Vec3;
}

/** Distance along the ray to the box, or null; null too for a ray with a NaN component or an infinite origin. A ray
 *  starting inside returns 0; one with an infinite direction component is at a finite place only at t = 0. */
export function intersectRayAabb(ray: Ray, box: Aabb): number | null {
  const { min, max } = box;
  let tMin = Number.NEGATIVE_INFINITY;
  let tMax = Number.POSITIVE_INFINITY;

  for (const axis of ['x', 'y', 'z'] as const) {
    const o = ray.origin[axis];
    const d = ray.direction[axis];
    // NaN fails every comparison below, so an axis it reached would never narrow the slab.
    if (Number.isNaN(d) || !Number.isFinite(o)) return null;
    // Any other finite direction, however short, divides to an honest (possibly infinite) t.
    if (d === 0 || !Number.isFinite(d)) {
      if (o < min[axis] || o > max[axis]) return null;
      if (d !== 0) tMax = Math.min(tMax, 0);
      continue;
    }
    let t1 = (min[axis] - o) / d;
    let t2 = (max[axis] - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    if (t1 > tMin) tMin = t1;
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return null;
  }

  if (tMax < 0 || tMin > tMax) return null;
  return tMin > 0 ? tMin : 0;
}

/** Plane is `dot(normal, p) === offset`. Null when the ray runs parallel to the
 *  plane to within rounding, or points away from it. */
export function intersectRayPlane(ray: Ray, normal: Vec3, offset: number): number | null {
  const denom = dot(normal, ray.direction);
  if (!(Math.abs(denom) > SINGULAR_RATIO * len(normal) * len(ray.direction))) return null;
  const t = (offset - dot(normal, ray.origin)) / denom;
  return t < 0 ? null : t;
}

/**
 * The axis-aligned box enclosing `local` after `m`. All eight corners are
 * transformed and re-bounded, so a rotation widens the result rather than
 * rotating it — an AABB cannot represent an oriented box, and pretending
 * otherwise is how a hit test starts missing its own geometry.
 */
export function transformAabb(m: Mat4, local: Aabb): Aabb {
  let min: Vec3 = { x: Infinity, y: Infinity, z: Infinity };
  let max: Vec3 = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (let i = 0; i < 8; i++) {
    const corner: Vec3 = {
      x: i & 1 ? local.max.x : local.min.x,
      y: i & 2 ? local.max.y : local.min.y,
      z: i & 4 ? local.max.z : local.min.z,
    };
    const p = transformPoint(m, corner);
    min = { x: Math.min(min.x, p.x), y: Math.min(min.y, p.y), z: Math.min(min.z, p.z) };
    max = { x: Math.max(max.x, p.x), y: Math.max(max.y, p.y), z: Math.max(max.z, p.z) };
  }
  return { min, max };
}

/** The box centred on `center` reaching `radius` along every axis. */
export function aabbAround(center: Vec3, radius: number): Aabb {
  return {
    min: { x: center.x - radius, y: center.y - radius, z: center.z - radius },
    max: { x: center.x + radius, y: center.y + radius, z: center.z + radius },
  };
}

/** The point `t` direction-lengths along the ray. */
export function pointOnRay(ray: Ray, t: number): Vec3 {
  return add(ray.origin, scale(ray.direction, t));
}

/** The smallest box containing every point, or null for none. A NaN coordinate is skipped, and an axis left with
 *  none answers null, as the 2D barrel's `boundsOfCoords` does. */
export function aabbOfPoints(points: readonly Vec3[]): Aabb | null {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const p of points) {
    for (const axis of ['x', 'y', 'z'] as const) {
      if (p[axis] < min[axis]) min[axis] = p[axis];
      if (p[axis] > max[axis]) max[axis] = p[axis];
    }
  }
  return min.x <= max.x && min.y <= max.y && min.z <= max.z ? { min, max } : null;
}

/** The point of the infinite line through `origin` along `direction` nearest
 *  `p`. A zero direction makes the line the point `origin`. */
export function nearestPointOnLine(p: Vec3, origin: Vec3, direction: Vec3): Vec3 {
  const v = squarable(direction).v;
  const d2 = len2(v);
  if (!(d2 > 0)) return origin;
  return add(origin, scale(v, dot(sub(p, origin), v) / d2));
}

/** `v` divided by its largest component when its squared length would leave the normal range, with that
 *  divisor `k`: the projections here are unchanged by the direction's length, and its square must not
 *  over- or underflow. `k` is 1 for every vector that squares in range, so those answer bit for bit as before. */
function squarable(v: Vec3): { v: Vec3; k: number } {
  if (squaresHeld(len2(v))) return { v, k: 1 };
  const k = Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z));
  if (!(k > 0 && k < Infinity)) return { v, k: 1 };
  // Divided, not scaled by 1 / k: a subnormal k's reciprocal overflows to Infinity.
  return { v: { x: v.x / k, y: v.y / k, z: v.z / k }, k };
}

/** The point of segment `a`–`b` nearest `p`; `a` when the segment has no
 *  length. The rule is `../points`', stated once for every dimension. */
export function nearestPointOnSegment(p: Vec3, a: Vec3, b: Vec3): Vec3 {
  const [x, y, z] = nearestPointOnSegmentN([p.x, p.y, p.z], [a.x, a.y, a.z], [b.x, b.y, b.z]);
  return { x: x!, y: y!, z: z! };
}

/**
 * The nearest pair of points between a ray and the infinite line through
 * `origin` along `direction`. `t` is the ray parameter (never negative) and
 * `s` the line's. A line parallel to the ray pairs with the ray's origin; a zero direction makes the line
 * the point `origin`, paired with the ray's point nearest it.
 */
export function nearestPointsRayLine(
  ray: Ray,
  origin: Vec3,
  direction: Vec3,
): { onRay: Vec3; onLine: Vec3; t: number; s: number } {
  const { v: u, k: ku } = squarable(ray.direction);
  const { v, k: kv } = squarable(direction);
  const w = sub(ray.origin, origin);
  const a = len2(u);
  const b = dot(u, v);
  const c = len2(v);
  const d = dot(u, w);
  const e = dot(v, w);
  const denom = a * c - b * b;
  let t = 0;
  if (a > 0 && c === 0) t = Math.max(0, -d / a);
  else if (a > 0 && denom > SINGULAR_RATIO * a * c) t = Math.max(0, (b * e - c * d) / denom);
  const onRay = add(ray.origin, scale(u, t));
  const s = c > 0 ? dot(sub(onRay, origin), v) / c : 0;
  return { onRay, onLine: add(origin, scale(v, s)), t: t / ku, s: s / kv };
}
