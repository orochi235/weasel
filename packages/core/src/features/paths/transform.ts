/**
 * In-place and copy-out path transforms. Translation is the most common —
 * called every pointermove during a drag — so the polygon variant mutates
 * the float buffer directly to keep allocation pressure off the GC.
 *
 * `scalePathToBounds` is for the resize interaction: given the path's
 * current AABB and the desired new AABB, scales every coordinate
 * proportionally. Degenerate source bounds (zero width/height) collapse
 * the corresponding axis to the new origin — preferable to dividing by
 * zero or refusing to resize.
 */

import { boxToBox, forEachSegment, pathCommandCoordCount } from '@weasel-js/geom';
import { boundsOfPath } from './bounds';
import { transformPath } from './transformPath';
import type { Path, PolygonPath, RectPath } from './types';

/**
 * Translate a path by (dx, dy). Returns a new instance — the kit's pose
 * model treats poses as immutable to keep React state-update semantics
 * predictable. Polygon coords are copied into a fresh `Float32Array`.
 */
export function translatePath(path: Path, dx: number, dy: number): Path {
  if (path.kind === 'rect') {
    return { kind: 'rect', x: path.x + dx, y: path.y + dy, width: path.width, height: path.height };
  }
  return translatePolygonCopy(path, dx, dy);
}

function translatePolygonCopy(path: PolygonPath, dx: number, dy: number): PolygonPath {
  const next = new Float32Array(path.coords.length);
  const { commands, coords } = path;
  forEachSegment(commands, coords, (cmd, ci) => {
    for (let k = 0, len = pathCommandCoordCount(cmd); k < len; k += 2) {
      next[ci + k] = coords[ci + k] + dx;
      next[ci + k + 1] = coords[ci + k + 1] + dy;
    }
  });
  return { kind: 'polygon', commands: path.commands, coords: next, fillRule: path.fillRule };
}

/**
 * Translate a polygon path's coords *in place*. Returns the same
 * `PolygonPath` reference. Use only for transient overlay buffers — never
 * for committed scene state, which must remain immutable for React.
 */
export function translatePolygonInPlace(path: PolygonPath, dx: number, dy: number): PolygonPath {
  const { commands, coords } = path;
  forEachSegment(commands, coords, (cmd, ci) => {
    for (let k = 0, len = pathCommandCoordCount(cmd); k < len; k += 2) {
      coords[ci + k] += dx;
      coords[ci + k + 1] += dy;
    }
  });
  return path;
}

/**
 * Scale a path's coords so its current AABB maps to `target`. Resize
 * interactions use this to make a polygon follow a corner-handle drag.
 *
 * Degenerate source axes (width or height == 0) collapse to `target.x` /
 * `target.y` — every coord on that axis becomes the new origin. Avoids
 * division by zero without throwing.
 */
export function scalePathToBounds(path: Path, target: RectPath): Path {
  if (path.kind === 'rect') {
    return { kind: 'rect', x: target.x, y: target.y, width: target.width, height: target.height };
  }
  const src = boundsOfPath(path);
  return scalePolygon(path, src, target);
}

function scalePolygon(path: PolygonPath, src: RectPath, dst: RectPath): PolygonPath {
  const m = boxToBox(src.x, src.y, src.width, src.height, dst.x, dst.y, dst.width, dst.height);
  // src/dst are axis-aligned, so the polygon stays a polygon after this pure scale+translate.
  return transformPath(path, m) as PolygonPath;
}
