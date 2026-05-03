/**
 * Point-in-path hit-testing. `RectPath` short-circuits to AABB compare
 * (O(1)). `PolygonPath` walks the command stream, flattening any bezier
 * segments to line segments, then runs ray-casting (even-odd) or
 * winding-number (non-zero) per the path's `fillRule`.
 *
 * Open subpaths (no `Z`) are skipped for filled hit-testing — they have
 * no enclosed area. A future `pointNearPath` (stroke-based hit-test for
 * polylines) would handle those; not in v1.
 */

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

export interface PointInPathOptions {
  /** Bezier flattening tolerance in world units. Default 0.5. */
  tolerance?: number;
}

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
