/** Writing 2D `Bounds` and `Rect`s into a reach tree's box layout, `[minX, minY, maxX, maxY]`. */
import type { Affine } from '@weasel-js/geom';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { BOX_ALL, BOX_SOME, type BoxImage, type BoxKind } from './reachTypes';

/** Write `b`, carried through `frame` when there is one, as a box at `out[at…]`. */
export function writeBounds(b: Bounds | null, frame: Affine | null, out: Float64Array, at: number): BoxKind {
  if (b === null) return BOX_ALL;
  const { x, y, width, height } = b;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) return BOX_ALL;
  if (frame === null) {
    out[at] = Math.min(x, x + width);
    out[at + 1] = Math.min(y, y + height);
    out[at + 2] = Math.max(x, x + width);
    out[at + 3] = Math.max(y, y + height);
    return BOX_SOME;
  }
  return writeImage(frame, x, y, x + width, y + height, out, at);
}

/** The box holding the corners of `[x0, y0, x1, y1]` carried through `m`. */
function writeImage(m: Affine, x0: number, y0: number, x1: number, y1: number, out: Float64Array, at: number): BoxKind {
  const [a, b, c, d, e, f] = m;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [px, py] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]] as const) {
    const qx = a * px + c * py + e;
    const qy = b * px + d * py + f;
    if (qx < minX) minX = qx;
    if (qx > maxX) maxX = qx;
    if (qy < minY) minY = qy;
    if (qy > maxY) maxY = qy;
  }
  if (!Number.isFinite(minX + minY + maxX + maxY)) return BOX_ALL;
  out[at] = minX;
  out[at + 1] = minY;
  out[at + 2] = maxX;
  out[at + 3] = maxY;
  return BOX_SOME;
}

/** A copy's transform as a {@link BoxImage}. */
export function affineImage(m: Affine): BoxImage {
  return (src, at, out, outAt) => writeImage(m, src[at]!, src[at + 1]!, src[at + 2]!, src[at + 3]!, out, outAt);
}
