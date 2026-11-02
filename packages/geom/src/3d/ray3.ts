/** Rays, axis-aligned boxes, and the intersections picking is built from. */

import { closestPointOnSegment as closestPointOnSegmentN } from '../points';
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

/** Distance along the ray to the box, or null. A ray starting inside returns 0. */
export function intersectRayAabb(ray: Ray, min: Vec3, max: Vec3): number | null {
  let tMin = Number.NEGATIVE_INFINITY;
  let tMax = Number.POSITIVE_INFINITY;

  for (const axis of ['x', 'y', 'z'] as const) {
    const o = ray.origin[axis];
    const d = ray.direction[axis];
    // Any other direction, however short, divides to an honest (possibly infinite) t.
    if (d === 0) {
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

/** The smallest box containing every point. No points gives an inverted
 *  box, `min` at +Infinity and `max` at -Infinity. */
export function aabbOfPoints(points: readonly Vec3[]): Aabb {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const p of points) {
    for (const axis of ['x', 'y', 'z'] as const) {
      if (p[axis] < min[axis]) min[axis] = p[axis];
      if (p[axis] > max[axis]) max[axis] = p[axis];
    }
  }
  return { min, max };
}

/** The point of the infinite line through `origin` along `direction` nearest
 *  `p`. A zero direction makes the line the point `origin`. */
export function closestPointOnLine(p: Vec3, origin: Vec3, direction: Vec3): Vec3 {
  const d2 = len2(direction);
  if (!(d2 > 0)) return origin;
  return add(origin, scale(direction, dot(sub(p, origin), direction) / d2));
}

/** The point of segment `a`–`b` nearest `p`; `a` when the segment has no
 *  length. The rule is `../points`', stated once for every dimension. */
export function closestPointOnSegment(p: Vec3, a: Vec3, b: Vec3): Vec3 {
  const [x, y, z] = closestPointOnSegmentN([p.x, p.y, p.z], [a.x, a.y, a.z], [b.x, b.y, b.z]);
  return { x: x!, y: y!, z: z! };
}

/**
 * The nearest pair of points between a ray and the infinite line through
 * `origin` along `direction`. `t` is the ray parameter (never negative) and
 * `s` the line's. A line parallel to the ray pairs with the ray's origin.
 */
export function closestPointsRayLine(
  ray: Ray,
  origin: Vec3,
  direction: Vec3,
): { onRay: Vec3; onLine: Vec3; t: number; s: number } {
  const u = ray.direction;
  const v = direction;
  const w = sub(ray.origin, origin);
  const a = len2(u);
  const b = dot(u, v);
  const c = len2(v);
  const d = dot(u, w);
  const e = dot(v, w);
  const denom = a * c - b * b;
  let t = 0;
  if (a > 0 && denom > SINGULAR_RATIO * a * c) t = Math.max(0, (b * e - c * d) / denom);
  const onRay = pointOnRay(ray, t);
  const s = c > 0 ? dot(sub(onRay, origin), v) / c : 0;
  return { onRay, onLine: add(origin, scale(v, s)), t, s };
}
