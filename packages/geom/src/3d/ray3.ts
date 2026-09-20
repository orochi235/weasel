/** Rays, axis-aligned boxes, and the intersections picking is built from. */

import { SINGULAR_RATIO } from '../scalar';
import { dot, len, type Vec3 } from './vec3';
import { transformPoint, type Mat4 } from './mat4';

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
