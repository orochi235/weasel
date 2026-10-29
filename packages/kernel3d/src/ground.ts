/**
 * The ground: the plane through the origin at right angles to `up`. A drag
 * inserts onto it, and a 2D world lies on it when a 3D view meets one.
 */

import type { AimPoint } from '@weasel-js/core';
import { intersectRayPlane, pointOnRay, type Vec3 } from '@weasel-js/geom/3d';
import { rayAt, type Viewport3d } from './project';

export type Axis = 'x' | 'y' | 'z';

/** `up`'s own axis, and the two it is not: a 2D world's x lies along `u` and its y along `v`. */
export interface GroundAxes {
  readonly u: Axis;
  readonly v: Axis;
  readonly up: Axis;
}

export function groundAxes(up: Vec3): GroundAxes {
  if (up.y !== 0) return { u: 'x', v: 'z', up: 'y' };
  if (up.x !== 0) return { u: 'y', v: 'z', up: 'x' };
  return { u: 'x', v: 'y', up: 'z' };
}

/** Where the ray through `point`, in the coordinates the viewport's pointer points arrive in, meets the ground, or `null`. */
export function groundHit(viewport: Viewport3d, point: { x: number; y: number }, up: Vec3): Vec3 | null {
  const ray = rayAt(viewport, point);
  const t = ray && intersectRayPlane(ray, up, 0);
  return ray && t !== null ? pointOnRay(ray, t) : null;
}

/** A world point as a 2D world reads it: its place along the ground axes as x and y, its height as z. */
export function toAimPoint(p: Vec3, axes: GroundAxes): AimPoint {
  return { x: p[axes.u], y: p[axes.v], z: p[axes.up] };
}

/** The world point an aim point names; a 2D world's point, with no z, lies on the ground. */
export function fromAimPoint(p: AimPoint, axes: GroundAxes): Vec3 {
  const out = { x: 0, y: 0, z: 0 };
  out[axes.u] = p.x;
  out[axes.v] = p.y;
  out[axes.up] = p.z ?? 0;
  return out;
}
