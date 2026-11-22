/**
 * Roughen a path: every point of its outline moved by a random offset, after
 * evenly spaced points are added to each segment. The offsets come from a
 * seed, so the same path and options always roughen the same way.
 */
import type { Path } from '../path';
import { countParam, polylineContour, sampleContour } from './contourSamples';
import { cubicContoursToPath, pathToCubicContours } from './cubicContours';

/** How a path is roughened. */
export interface RoughenPathOptions {
  /** The largest offset on each axis, in the path's units. */
  size: number;
  /** Points added to each segment before roughening. Default 4. */
  detail?: number;
  /** Picks the offsets; every distinct number, fractions included, picks its own. Default 0. */
  seed?: number;
}

const seedBits = new DataView(new ArrayBuffer(8));

/** `seed` as an int32: itself when it is one, else both halves of its double mixed, so fractional and large seeds
 *  stay apart. */
function seedWord(seed: number): number {
  if ((seed | 0) === seed) return seed | 0;
  seedBits.setFloat64(0, seed);
  return seedBits.getInt32(4) ^ Math.imul(seedBits.getInt32(0), 0x27d4eb2f);
}

/** A number in `[0, 1)` from `seed` and two indices: the same three always give the same one. */
function hash01(seed: number, i: number, k: number): number {
  let h = Math.imul(seed ^ 0x2545f491, 0x9e3779b1) ^ Math.imul(i + 1, 0x85ebca77) ^ Math.imul(k + 1, 0xc2b2ae3d);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * `path` with each point of its outline, anchors and the `detail` points added
 * between them, moved by up to `size` on each axis, joined by straight
 * segments. A `size` of zero or less answers `path` itself.
 */
export function roughenPath(path: Path, opts: RoughenPathOptions): Path {
  const { size, seed = 0 } = opts;
  if (!(size > 0 && Number.isFinite(size))) return path;
  const pieces = countParam(opts.detail, 4) + 1;
  const word = seedWord(seed);
  const contours = pathToCubicContours(path).map((contour, r) => polylineContour(
    sampleContour(contour, pieces).map(({ at }, i) => ({
      x: at.x + (hash01(word, i, 2 * r) * 2 - 1) * size,
      y: at.y + (hash01(word, i, 2 * r + 1) * 2 - 1) * size,
    })),
    contour.closed,
  ));
  return cubicContoursToPath(contours, path);
}
