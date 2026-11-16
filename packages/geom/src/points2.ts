/**
 * The rules of `./points` in the 2D kernel's currency. The segment functions
 * take loose scalars and allocate nothing, since hit tests call them per
 * pointermove and per vertex; the point functions take `Point`. Each goes
 * through the same scalar steps as its `./nd` counterpart, so the two agree
 * to the bit.
 */

import { segmentTFrom, squaresHeld } from './points';
import { lerp } from './scalar';
import type { Point } from './paths/cubicMath';

/** Squared distance between two points. */
export function distance2(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/** The length of (dx, dy), finite wherever the length itself is, by the same steps as `./points`' `distance`.
 *  Not public. */
export function lengthOf(dx: number, dy: number): number {
  const s = dx * dx + dy * dy;
  if (squaresHeld(s)) return Math.sqrt(s);
  const most = Math.max(Math.abs(dx), Math.abs(dy));
  if (!(most > 0) || most === Infinity) return Math.sqrt(s);
  const qx = dx / most, qy = dy / most;
  return most * Math.sqrt(qx * qx + qy * qy);
}

/** Euclidean distance between two points, finite wherever the distance itself is. */
export function distance(a: Point, b: Point): number {
  return lengthOf(a.x - b.x, a.y - b.y);
}

/** The point `t` of the way from `a` to `b`; `t` outside [0, 1] extrapolates. */
export function lerpPoint(a: Point, b: Point, t: number): Point {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

/** The parameter, 0 to 1, of the point of segment (ax,ay)-(bx,by) nearest
 *  (px,py). A zero-length segment answers 0. */
export function segmentT(
  px: number, py: number, ax: number, ay: number, bx: number, by: number,
): number {
  const vx = bx - ax, vy = by - ay;
  const wv = (px - ax) * vx + (py - ay) * vy, vv = vx * vx + vy * vy;
  const most = Math.max(Math.abs(vx), Math.abs(vy));
  if ((squaresHeld(vv) && wv === wv) || !(most > 0) || most === Infinity) return segmentTFrom(wv, vv);
  const ux = vx / most, uy = vy / most;
  return segmentTFrom(((px - ax) / most) * ux + ((py - ay) / most) * uy, ux * ux + uy * uy);
}

/** Squared distance from (px,py) to segment (ax,ay)-(bx,by), endpoint-clamped. */
export function pointSegmentDist2(
  px: number, py: number, ax: number, ay: number, bx: number, by: number,
): number {
  const t = segmentT(px, py, ax, ay, bx, by);
  const dx = px - (t === 1 ? bx : lerp(ax, bx, t));
  const dy = py - (t === 1 ? by : lerp(ay, by, t));
  return dx * dx + dy * dy;
}

/** Distance from (px,py) to segment (ax,ay)-(bx,by), endpoint-clamped. */
export function pointSegmentDist(
  px: number, py: number, ax: number, ay: number, bx: number, by: number,
): number {
  const t = segmentT(px, py, ax, ay, bx, by);
  return lengthOf(px - (t === 1 ? bx : lerp(ax, bx, t)), py - (t === 1 ? by : lerp(ay, by, t)));
}
