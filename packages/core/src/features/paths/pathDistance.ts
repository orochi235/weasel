/**
 * Pure-geometry distance from a point to a path's boundary (stroke), with
 * no fill-side logic. Used by pickers that want to know "how close is this
 * click to the visible edge of the shape?" Callers combine this with
 * `pathContainsPoint` from `pathHitTest.ts` to get a closed-region
 * pick distance (0 inside, stroke-distance outside).
 *
 * Implementation: walks the command stream. Line segments use the exact
 * point-to-segment formula. Cubic beziers sample N+1 points along the
 * curve and reduce to point-to-segment over the polyline approximation —
 * cheap and accurate to ~1 px for typical edit-tool sampling counts.
 * Quadratic beziers fall through to the cubic sampler via equivalence.
 *
 * RectPath short-circuits to AABB-perimeter math: O(1).
 */

import { cubicEvalAt, elevateQuadraticToCubic, forEachSegment, pointSegmentDist2 } from '@weasel-js/geom';
import {
  PATH_C,
  PATH_L,
  PATH_M,
  PATH_Q,
  PATH_Z,
  type Path,
  type PolygonPath,
} from './types';

/** Samples per bezier segment. 16 is the sweet spot — sub-pixel accuracy at
 *  typical zoom levels and cheap enough for tens of paths per pick. */
const BEZIER_SAMPLES = 16;

/** Closest squared distance from (px, py) to a cubic bezier
 *  (x0,y0)-(x1,y1)-(x2,y2)-(x3,y3). Polyline-approximation; accurate to
 *  ~1px at default `BEZIER_SAMPLES`. */
function pointCubicDist2(
  px: number, py: number,
  x0: number, y0: number, x1: number, y1: number,
  x2: number, y2: number, x3: number, y3: number,
): number {
  let prevX = x0, prevY = y0;
  let best = Infinity;
  for (let i = 1; i <= BEZIER_SAMPLES; i++) {
    const [sx, sy] = cubicEvalAt(x0, y0, x1, y1, x2, y2, x3, y3, i / BEZIER_SAMPLES);
    const d2 = pointSegmentDist2(px, py, prevX, prevY, sx, sy);
    if (d2 < best) best = d2;
    prevX = sx; prevY = sy;
  }
  return best;
}

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
  return polygonPathDistance(path, px, py);
}

function polygonPathDistance(path: PolygonPath, px: number, py: number): number {
  const { commands, coords } = path;
  let startX = 0, startY = 0;
  let best = Infinity;
  const consider = (d2: number) => { if (d2 < best) best = d2; };

  forEachSegment(commands, coords, (cmd, ci, curX, curY) => {
    switch (cmd) {
      case PATH_M:
        startX = coords[ci]; startY = coords[ci + 1];
        break;
      case PATH_L:
        consider(pointSegmentDist2(px, py, curX, curY, coords[ci], coords[ci + 1]));
        break;
      case PATH_C:
        consider(pointCubicDist2(
          px, py, curX, curY,
          coords[ci], coords[ci + 1],
          coords[ci + 2], coords[ci + 3],
          coords[ci + 4], coords[ci + 5],
        ));
        break;
      case PATH_Q: {
        const x = coords[ci + 2], y = coords[ci + 3];
        const [c1x, c1y, c2x, c2y] = elevateQuadraticToCubic(curX, curY, coords[ci], coords[ci + 1], x, y);
        consider(pointCubicDist2(px, py, curX, curY, c1x, c1y, c2x, c2y, x, y));
        break;
      }
      case PATH_Z:
        consider(pointSegmentDist2(px, py, curX, curY, startX, startY));
        break;
      default:
        throw new Error(`pathDistanceToPoint: unknown command code ${cmd}`);
    }
  });

  return best === Infinity ? Infinity : Math.sqrt(best);
}
