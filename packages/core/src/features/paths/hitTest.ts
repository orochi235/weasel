/**
 * Point-in-path hit-testing. `RectPath` short-circuits to AABB compare
 * (O(1)). `PolygonPath` walks the command stream, flattening any bezier
 * segments to line segments, then runs ray-casting (even-odd) or
 * winding-number (non-zero) per the path's `fillRule`.
 *
 * Open subpaths (no `Z`) are skipped for filled hit-testing — they have
 * no enclosed area. For open polylines (strokes), use `strokeHitTest`
 * which computes point-to-segment distance against the flattened
 * polyline and returns true within a configurable threshold.
 */

import { pointSegmentDist2 } from '@weasel-js/geom';
import { flattenCubic, flattenQuadratic, DEFAULT_FLATTEN_TOLERANCE } from './flatten';
import {
  PATH_C,
  PATH_L,
  PATH_M,
  PATH_Q,
  PATH_Z,
  type Path,
  type PolygonPath,
} from './types';

/** Options for `pointInPath`. */
export interface PointInPathOptions {
  /** Bezier flattening tolerance in world units. Default 0.5. */
  tolerance?: number;
}

/** Filled-region hit-test for a `Path`. Rect short-circuits to AABB; polygons run ray-cast / winding per `fillRule`. */
export function pointInPath(
  path: Path,
  x: number,
  y: number,
  opts: PointInPathOptions = {},
): boolean {
  if (path.kind === 'rect') {
    return x >= path.x && x <= path.x + path.width && y >= path.y && y <= path.y + path.height;
  }
  return pointInPolygonPath(path, x, y, opts.tolerance ?? DEFAULT_FLATTEN_TOLERANCE);
}

function pointInPolygonPath(path: PolygonPath, x: number, y: number, tolerance: number): boolean {
  const { commands, coords, fillRule } = path;
  if (commands.length === 0) return false;

  // Walk the command stream; flatten beziers into per-subpath vertex arrays.
  // For each closed subpath, accumulate winding/crossings against (x, y).
  let crossings = 0;
  let winding = 0;

  let subStartX = 0, subStartY = 0;
  let curX = 0, curY = 0;
  let subVerts: number[] = []; // flat [x, y, x, y, ...] for current subpath
  let subOpen = false;

  const flushSubpath = (closed: boolean) => {
    if (closed && subVerts.length >= 4) {
      // Close the subpath back to its start.
      subVerts.push(subStartX, subStartY);
      // Now subVerts is a closed polyline; tally crossings/winding.
      for (let i = 0; i < subVerts.length - 2; i += 2) {
        const ax = subVerts[i],     ay = subVerts[i + 1];
        const bx = subVerts[i + 2], by = subVerts[i + 3];
        if (segmentCrossesRayRight(x, y, ax, ay, bx, by)) {
          crossings++;
          if (ay <= y && by > y) winding++;
          else if (by <= y && ay > y) winding--;
        }
      }
    }
    subVerts = [];
    subOpen = false;
  };

  let ci = 0;
  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    switch (cmd) {
      case PATH_M: {
        if (subOpen) flushSubpath(false);
        subStartX = coords[ci]; subStartY = coords[ci + 1];
        curX = subStartX; curY = subStartY;
        subVerts.push(curX, curY);
        subOpen = true;
        ci += 2;
        break;
      }
      case PATH_L: {
        curX = coords[ci]; curY = coords[ci + 1];
        subVerts.push(curX, curY);
        ci += 2;
        break;
      }
      case PATH_C: {
        const x1 = coords[ci],     y1 = coords[ci + 1];
        const x2 = coords[ci + 2], y2 = coords[ci + 3];
        const x3 = coords[ci + 4], y3 = coords[ci + 5];
        flattenCubic(curX, curY, x1, y1, x2, y2, x3, y3, tolerance, subVerts);
        curX = x3; curY = y3;
        ci += 6;
        break;
      }
      case PATH_Q: {
        const x1 = coords[ci],     y1 = coords[ci + 1];
        const x2 = coords[ci + 2], y2 = coords[ci + 3];
        flattenQuadratic(curX, curY, x1, y1, x2, y2, tolerance, subVerts);
        curX = x2; curY = y2;
        ci += 4;
        break;
      }
      case PATH_Z: {
        flushSubpath(true);
        curX = subStartX; curY = subStartY;
        break;
      }
      default:
        throw new Error(`pointInPath: unknown command ${cmd}`);
    }
  }
  if (subOpen) flushSubpath(false);

  return fillRule === 'evenodd' ? (crossings & 1) === 1 : winding !== 0;
}

/**
 * Does the rightward horizontal ray from (x, y) cross segment (ax,ay)→(bx,by)?
 * Standard half-open rule (segments touching from above count, from below
 * don't) — avoids double-counting at shared vertices.
 */
function segmentCrossesRayRight(
  x: number, y: number,
  ax: number, ay: number,
  bx: number, by: number,
): boolean {
  if ((ay > y) === (by > y)) return false;
  const xCross = ax + ((y - ay) / (by - ay)) * (bx - ax);
  return x < xCross;
}

/** Options for {@link strokeHitTest}. */
export interface StrokeHitTestOptions {
  /** Bezier flattening tolerance in world units. Default 0.5. */
  tolerance?: number;
}

/**
 * Stroke-distance hit-test. Returns true when (x, y) lies within
 * `threshold` world units of the path's outline — i.e. when a stroke
 * of total width `2 * threshold` drawn along the path would cover the
 * point.
 *
 * Works for both closed and open subpaths — unlike {@link pointInPath},
 * which only tests filled regions. Use this for picking on open
 * polylines / curves and for adding stroke-clickability to closed
 * shapes (logical OR with `pointInPath` when both behaviors are
 * desired).
 *
 * `threshold` is typically the stroke's half-width plus a small slop
 * (e.g. `strokeWidth / 2 + 4`). Cap segments are approximated by the
 * threshold radius around each anchor — the test treats every flattened
 * segment as a capsule of width `2 * threshold`.
 */
export function strokeHitTest(
  path: Path,
  x: number,
  y: number,
  threshold: number,
  opts: StrokeHitTestOptions = {},
): boolean {
  const t2 = threshold * threshold;
  if (path.kind === 'rect') {
    const { x: rx, y: ry, width: w, height: h } = path;
    return (
      pointSegmentDist2(x, y, rx, ry, rx + w, ry) <= t2
      || pointSegmentDist2(x, y, rx + w, ry, rx + w, ry + h) <= t2
      || pointSegmentDist2(x, y, rx + w, ry + h, rx, ry + h) <= t2
      || pointSegmentDist2(x, y, rx, ry + h, rx, ry) <= t2
    );
  }
  return polylineWithinThreshold(path, x, y, t2, opts.tolerance ?? DEFAULT_FLATTEN_TOLERANCE);
}

function polylineWithinThreshold(
  path: PolygonPath,
  px: number, py: number,
  t2: number,
  tolerance: number,
): boolean {
  const { commands, coords } = path;
  if (commands.length === 0) return false;

  // Reuse pointInPath's command-stream + flatten walk; check distance from
  // (px, py) to each emitted segment instead of accumulating crossings.
  let subStartX = 0, subStartY = 0;
  let curX = 0, curY = 0;
  let subVerts: number[] = [];
  let subOpen = false;

  const checkSegments = (closed: boolean): boolean => {
    if (closed && subVerts.length >= 4) subVerts.push(subStartX, subStartY);
    for (let i = 0; i < subVerts.length - 2; i += 2) {
      if (pointSegmentDist2(px, py, subVerts[i], subVerts[i + 1], subVerts[i + 2], subVerts[i + 3]) <= t2) {
        return true;
      }
    }
    return false;
  };

  let ci = 0;
  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    switch (cmd) {
      case PATH_M: {
        if (subOpen) {
          if (checkSegments(false)) return true;
          subVerts = [];
        }
        subStartX = coords[ci]; subStartY = coords[ci + 1];
        curX = subStartX; curY = subStartY;
        subVerts.push(curX, curY);
        subOpen = true;
        ci += 2;
        break;
      }
      case PATH_L: {
        curX = coords[ci]; curY = coords[ci + 1];
        subVerts.push(curX, curY);
        ci += 2;
        break;
      }
      case PATH_C: {
        const x1 = coords[ci],     y1 = coords[ci + 1];
        const x2 = coords[ci + 2], y2 = coords[ci + 3];
        const x3 = coords[ci + 4], y3 = coords[ci + 5];
        flattenCubic(curX, curY, x1, y1, x2, y2, x3, y3, tolerance, subVerts);
        curX = x3; curY = y3;
        ci += 6;
        break;
      }
      case PATH_Q: {
        const x1 = coords[ci],     y1 = coords[ci + 1];
        const x2 = coords[ci + 2], y2 = coords[ci + 3];
        flattenQuadratic(curX, curY, x1, y1, x2, y2, tolerance, subVerts);
        curX = x2; curY = y2;
        ci += 4;
        break;
      }
      case PATH_Z: {
        if (checkSegments(true)) return true;
        subVerts = [];
        subOpen = false;
        curX = subStartX; curY = subStartY;
        break;
      }
      default:
        throw new Error(`strokeHitTest: unknown command ${cmd}`);
    }
  }
  if (subOpen && checkSegments(false)) return true;
  return false;
}
