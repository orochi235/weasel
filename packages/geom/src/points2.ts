/**
 * The rules of `./points` in the 2D kernel's currency. The segment functions
 * take loose scalars and allocate nothing, since hit tests call them per
 * pointermove and per vertex; the point functions take `Point`. Each goes
 * through the same scalar steps as its `./nd` counterpart, so the two agree
 * to the bit.
 */

import { segmentTFrom } from './points';
import { lerp } from './scalar';
import type { Point } from './paths/cubicMath';

/** Squared distance between two points. */
export function distance2(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/** Euclidean distance between two points. */
export function distance(a: Point, b: Point): number {
  return Math.sqrt(distance2(a, b));
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
  return segmentTFrom((px - ax) * vx + (py - ay) * vy, vx * vx + vy * vy);
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
  return Math.sqrt(pointSegmentDist2(px, py, ax, ay, bx, by));
}
