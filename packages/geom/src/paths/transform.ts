/**
 * In-place and copy-out path transforms. Translation is the most common —
 * called every pointermove during a drag — so the polygon variant mutates
 * the float buffer directly to keep allocation pressure off the GC.
 *
 * `fitPathToRect` is for the resize interaction: given the path's
 * current AABB and the desired new AABB, scales every coordinate
 * proportionally.
 */

import { rectToRect } from '../affine';
import { forEachSegment, pathCommandCoordCount } from '../commands';
import { boundsOfPath } from './bounds';
import { ORIGIN_THRESHOLD } from './pathOrigin';
import { transformPath } from './transformPath';
import type { Path, PolygonPath, RectPath } from '../path';

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
  const o = path.origin;
  if (o) return { ...path, coords: path.coords.slice(), origin: { x: o.x + dx, y: o.y + dy } };
  const next = new Float32Array(path.coords.length);
  const { commands, coords } = path;
  let reach = 0;
  forEachSegment(commands, coords, (cmd, ci) => {
    for (let k = 0, len = pathCommandCoordCount(cmd); k < len; k += 2) {
      const x = coords[ci + k] + dx, y = coords[ci + k + 1] + dy;
      next[ci + k] = x;
      next[ci + k + 1] = y;
      reach = Math.max(reach, Math.abs(x), Math.abs(y));
    }
  });
  // Past the threshold the float32 copy has lost the fraction; pick an origin as transformPath does.
  if (reach >= ORIGIN_THRESHOLD) return transformPath(path, [1, 0, 0, 1, dx, dy]) as PolygonPath;
  return { ...path, coords: next };
}

/**
 * Scale and translate a path's coords so its current AABB maps onto `target`. Resize
 * interactions use this to make a polygon follow a corner-handle drag.
 *
 * A degenerate source axis (zero width or height) has no ratio to scale by,
 * so `rectToRect` translates that axis instead — a zero scale is not
 * invertible and would discard what is left on it.
 */
export function fitPathToRect(path: Path, target: RectPath): Path {
  if (path.kind === 'rect') {
    return { kind: 'rect', x: target.x, y: target.y, width: target.width, height: target.height };
  }
  const src = boundsOfPath(path);
  return scalePolygon(path, src, target);
}

function scalePolygon(path: PolygonPath, src: RectPath, dst: RectPath): PolygonPath {
  const m = rectToRect(src.x, src.y, src.width, src.height, dst.x, dst.y, dst.width, dst.height);
  // src/dst are axis-aligned, so the polygon stays a polygon after this pure scale+translate.
  return transformPath(path, m) as PolygonPath;
}
