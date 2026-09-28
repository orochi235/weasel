/**
 * Pure-geometry distance from a point to a path's boundary (stroke), with
 * no fill-side logic. Used by pickers that want to know "how close is this
 * click to the visible edge of the shape?" Callers combine this with
 * `pathContainsPoint` from `pathHitTest.ts` to get a closed-region
 * pick distance (0 inside, stroke-distance outside).
 *
 * A polygon path defers to geom's `nearestOnPath`; a RectPath short-circuits
 * to AABB-perimeter math.
 */

import { nearestOnPath } from '@weasel-js/geom';
import type { Path } from './types';

/** Distance from (px, py) to the perimeter of an axis-aligned rectangle.
 *  Returns 0 if the point is on the perimeter; positive value outside or
 *  inside (distance to the nearest edge). */
function pointToRectPerimeterDist(
  px: number, py: number,
  rx: number, ry: number, rw: number, rh: number,
): number {
  // Distance to the rect as a region: 0 if inside, else Euclidean distance
  // to the AABB. For interior points, return distance to the closest edge.
  const dx = Math.max(rx - px, px - (rx + rw), 0);
  const dy = Math.max(ry - py, py - (ry + rh), 0);
  if (dx > 0 || dy > 0) return Math.hypot(dx, dy);
  // Inside: distance to closest edge.
  const left = px - rx, right = rx + rw - px;
  const top = py - ry, bottom = ry + rh - py;
  return Math.min(left, right, top, bottom);
}

/** Closest Euclidean distance from (px, py) to the boundary of `path`.
 *  Pure stroke distance — does *not* consult fill rule or interior. For
 *  closed-region pick distance ("0 inside, stroke-distance outside"),
 *  combine with `pathContainsPoint` at the call site. */
export function pathDistanceToPoint(path: Path, px: number, py: number): number {
  if (path.kind === 'rect') {
    return pointToRectPerimeterDist(px, py, path.x, path.y, path.width, path.height);
  }
  return nearestOnPath(path.commands, path.coords, px, py)?.dist ?? Infinity;
}
