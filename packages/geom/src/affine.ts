import type { Mat3 } from './mat3';

/**
 * Apply an affine to an interleaved coord stream, returning a fresh f64
 * buffer. Command codes are unaffected — for a Bezier the transformed control
 * points define the transformed curve exactly (affine invariance), so callers
 * pass `path.coords` straight through and keep `path.commands` as-is.
 */
export function transformCoords(coords: ArrayLike<number>, m: Mat3): Float64Array {
  const out = new Float64Array(coords.length);
  const a = m[0], b = m[1], c = m[2], d = m[3], e = m[4], f = m[5];
  for (let i = 0; i + 1 < coords.length; i += 2) {
    const x = coords[i], y = coords[i + 1];
    out[i] = a * x + c * y + e;
    out[i + 1] = b * x + d * y + f;
  }
  return out;
}
