/**
 * The ground: the plane through the origin at right angles to `up`. A drag
 * inserts onto it, and a 2D world lies on it when a 3D view meets one.
 */

import type { AimPoint } from '@weasel-js/core/engine';
import type { Vec3 } from '@weasel-js/geom/3d';
import { castOntoPlane, type Viewport3d } from './project';

export type Axis = 'x' | 'y' | 'z';

/** `up`'s own axis, and the two it is not: a 2D world's x lies along `u` and its y along `v`. */
export interface GroundAxes {
  readonly u: Axis;
  readonly v: Axis;
  readonly up: Axis;
  /** -1 when `up` points down its axis, so height still grows along `up`. */
  readonly sign: 1 | -1;
}

/** `up`'s own axis is the one it leans along most, so rounding left in the others is not read as a lean. */
export function groundAxes(up: Vec3): GroundAxes {
  const x = Math.abs(up.x), y = Math.abs(up.y), z = Math.abs(up.z);
  const sign = (v: number): 1 | -1 => (v < 0 ? -1 : 1);
  if (y >= x && y >= z) return { u: 'x', v: 'z', up: 'y', sign: sign(up.y) };
  if (x >= z) return { u: 'y', v: 'z', up: 'x', sign: sign(up.x) };
  return { u: 'x', v: 'y', up: 'z', sign: sign(up.z) };
}

/** Where the ray through `point`, in the coordinates the viewport's pointer points arrive in, meets the ground, or
 *  `null`. The camera turns about `up`, the world's. */
export function groundHit(viewport: Viewport3d, point: { x: number; y: number }, up: Vec3): Vec3 | null {
  return castOntoPlane({ ...viewport, up }, point, up, 0);
}

/** A world point as a 2D world reads it: its place along the ground axes as x and y, its height as z. */
export function toAimPoint(p: Vec3, axes: GroundAxes): AimPoint {
  // `+ 0` keeps a point on the ground at height 0 rather than -0.
  return { x: p[axes.u], y: p[axes.v], z: p[axes.up] * axes.sign + 0 };
}

/** The world point an aim point names; a 2D world's point, with no z, lies on the ground. */
export function fromAimPoint(p: AimPoint, axes: GroundAxes): Vec3 {
  const out = { x: 0, y: 0, z: 0 };
  out[axes.u] = p.x;
  out[axes.v] = p.y;
  out[axes.up] = (p.z ?? 0) * axes.sign + 0;
  return out;
}
