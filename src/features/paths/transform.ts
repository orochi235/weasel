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

import { boundsOfPath } from './bounds';
import { PATH_C, PATH_L, PATH_M, PATH_Q, PATH_Z, type Path, type PolygonPath, type RectPath } from './types';

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
  let ci = 0;
  for (let i = 0; i < commands.length; i++) {
    const len = COORD_COUNT[commands[i]];
    for (let k = 0; k < len; k += 2) {
      next[ci + k] = coords[ci + k] + dx;
      next[ci + k + 1] = coords[ci + k + 1] + dy;
    }
    ci += len;
  }
  return { kind: 'polygon', commands: path.commands, coords: next, fillRule: path.fillRule };
}

/**
 * Translate a polygon path's coords *in place*. Returns the same
 * `PolygonPath` reference. Use only for transient overlay buffers — never
 * for committed scene state, which must remain immutable for React.
 */
export function translatePolygonInPlace(path: PolygonPath, dx: number, dy: number): PolygonPath {
  const { commands, coords } = path;
  let ci = 0;
  for (let i = 0; i < commands.length; i++) {
    const len = COORD_COUNT[commands[i]];
    for (let k = 0; k < len; k += 2) {
      coords[ci + k] += dx;
      coords[ci + k + 1] += dy;
    }
    ci += len;
  }
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
  const sx = src.width === 0 ? 0 : dst.width / src.width;
  const sy = src.height === 0 ? 0 : dst.height / src.height;
  const next = new Float32Array(path.coords.length);
  const { commands, coords } = path;
  let ci = 0;
  for (let i = 0; i < commands.length; i++) {
    const len = COORD_COUNT[commands[i]];
    for (let k = 0; k < len; k += 2) {
      next[ci + k] = dst.x + (coords[ci + k] - src.x) * sx;
      next[ci + k + 1] = dst.y + (coords[ci + k + 1] - src.y) * sy;
    }
    ci += len;
  }
  return { kind: 'polygon', commands: path.commands, coords: next, fillRule: path.fillRule };
}

const COORD_COUNT: Readonly<Record<number, number>> = {
  [PATH_M]: 2,
  [PATH_L]: 2,
  [PATH_C]: 6,
  [PATH_Q]: 4,
  [PATH_Z]: 0,
};
