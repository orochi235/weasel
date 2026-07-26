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

/** Squared distance from (px, py) to segment (ax, ay)-(bx, by). */
function pointSegDist2(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) {
    const ex = px - ax, ey = py - ay;
    return ex * ex + ey * ey;
  }
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  if (t < 0) t = 0; else if (t > 1) t = 1;
  const cx = ax + dx * t, cy = ay + dy * t;
  const ex = px - cx, ey = py - cy;
  return ex * ex + ey * ey;
}

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
    const t = i / BEZIER_SAMPLES;
    const u = 1 - t;
    const sx = u*u*u*x0 + 3*u*u*t*x1 + 3*u*t*t*x2 + t*t*t*x3;
    const sy = u*u*u*y0 + 3*u*u*t*y1 + 3*u*t*t*y2 + t*t*t*y3;
    const d2 = pointSegDist2(px, py, prevX, prevY, sx, sy);
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
  let ci = 0;
  // Per-subpath state: where the subpath started, current pen position.
  let startX = 0, startY = 0;
  let curX = 0, curY = 0;
  let best = Infinity;
  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    if (cmd === PATH_M) {
      startX = coords[ci]; startY = coords[ci + 1];
      curX = startX; curY = startY;
      ci += 2;
    } else if (cmd === PATH_L) {
      const x = coords[ci], y = coords[ci + 1];
      const d2 = pointSegDist2(px, py, curX, curY, x, y);
      if (d2 < best) best = d2;
      curX = x; curY = y;
      ci += 2;
    } else if (cmd === PATH_C) {
      const c1x = coords[ci], c1y = coords[ci + 1];
      const c2x = coords[ci + 2], c2y = coords[ci + 3];
      const x = coords[ci + 4], y = coords[ci + 5];
      const d2 = pointCubicDist2(px, py, curX, curY, c1x, c1y, c2x, c2y, x, y);
      if (d2 < best) best = d2;
      curX = x; curY = y;
      ci += 6;
    } else if (cmd === PATH_Q) {
      // Quadratic → cubic conversion: c1 = q1*2/3 + start*1/3, c2 = q1*2/3 + end*1/3
      const qx = coords[ci], qy = coords[ci + 1];
      const x = coords[ci + 2], y = coords[ci + 3];
      const c1x = curX + (2 / 3) * (qx - curX);
      const c1y = curY + (2 / 3) * (qy - curY);
      const c2x = x + (2 / 3) * (qx - x);
      const c2y = y + (2 / 3) * (qy - y);
      const d2 = pointCubicDist2(px, py, curX, curY, c1x, c1y, c2x, c2y, x, y);
      if (d2 < best) best = d2;
      curX = x; curY = y;
      ci += 4;
    } else if (cmd === PATH_Z) {
      // Closing line back to subpath start.
      const d2 = pointSegDist2(px, py, curX, curY, startX, startY);
      if (d2 < best) best = d2;
      curX = startX; curY = startY;
    }
  }
  return best === Infinity ? Infinity : Math.sqrt(best);
}
