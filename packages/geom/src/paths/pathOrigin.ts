/**
 * A polygon path's coords read in the path's own space: each pair plus
 * `PolygonPath.origin`, added in doubles. Every reader that answers in that
 * space (hit tests, anchors, booleans, SVG data) reads through here.
 */
import type { PolygonPath } from '../path';
import type { Point } from './cubicMath';

const ZERO: { readonly x: number; readonly y: number } = Object.freeze({ x: 0, y: 0 });

/** The point `path`'s coords are measured from: `(0, 0)` when it has none. */
export function originOf(path: PolygonPath): { readonly x: number; readonly y: number } {
  return path.origin ?? ZERO;
}

/** Coordinate pair `i` of `path` (coords `2i`, `2i + 1`) in the path's own space. */
export function pathPoint(path: PolygonPath, i: number): Point {
  const o = originOf(path);
  return { x: o.x + path.coords[2 * i], y: o.y + path.coords[2 * i + 1] };
}

/**
 * `path.coords` in the path's own space, in doubles: the coords themselves
 * when the path has no origin, else a `Float64Array` of each pair plus it.
 */
export function worldCoords(path: PolygonPath): Float32Array | Float64Array {
  return path.origin ? addOrigin(path, Float64Array.from(path.coords)) : path.coords;
}

/** `xy`, interleaved pairs measured from `path`'s origin, moved into the
 *  path's own space in place: for a reader that derived offsets from the coords. */
export function addOrigin<T extends { [i: number]: number; readonly length: number }>(path: PolygonPath, xy: T): T {
  const o = path.origin;
  if (o === undefined) return xy;
  for (let i = 0; i + 1 < xy.length; i += 2) {
    xy[i] += o.x;
    xy[i + 1] += o.y;
  }
  return xy;
}

/** `world`, interleaved pairs in a path's own space, as the float32 coords
 *  of a path measured from `origin`: the inverse of {@link worldCoords}. */
export function coordsFrom(origin: { readonly x: number; readonly y: number } | undefined, world: ArrayLike<number>): Float32Array {
  const ox = origin?.x ?? 0, oy = origin?.y ?? 0;
  const out = new Float32Array(world.length);
  for (let i = 0; i + 1 < world.length; i += 2) {
    out[i] = world[i] - ox;
    out[i + 1] = world[i + 1] - oy;
  }
  return out;
}

/**
 * How far from 0 a coordinate may sit before a producer that picks its own
 * origin (`PathBuilder.autoOrigin`, `transformPath`'s `autoOrigin`) gives the
 * path one: 2^14. Past it a float32 coordinate's step is 1/512 world unit or
 * coarser, so its rounding reaches 1/16 px at 64x zoom; inside it, paths in a
 * document near 0 stay as they always were.
 */
export const ORIGIN_THRESHOLD = 16_384;

/** The origin a path through the interleaved pairs `xy` is measured from: none
 *  while every coordinate is within {@link ORIGIN_THRESHOLD} of 0, else the
 *  center of their bounds, rounded to whole units. */
export function originFor(xy: ArrayLike<number>): { x: number; y: number } | undefined {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i + 1 < xy.length; i += 2) {
    const x = xy[i], y = xy[i + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const reach = Math.max(Math.abs(minX), Math.abs(maxX), Math.abs(minY), Math.abs(maxY));
  if (!(reach >= ORIGIN_THRESHOLD) || !Number.isFinite(reach)) return undefined;
  return { x: Math.round((minX + maxX) / 2), y: Math.round((minY + maxY) / 2) };
}
