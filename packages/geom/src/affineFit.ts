import type { Affine } from './affine';

/**
 * The affine map carrying the points of `from` closest to those of `to`, by
 * least squares; both are interleaved `x, y` streams of the same length. When
 * the points lie on one line an affine map is not determined, and the
 * similarity (turn, even scale and move) is returned instead. Null for fewer
 * than two distinct points.
 */
export function fitAffine(from: ArrayLike<number>, to: ArrayLike<number>): Affine | null {
  const n = Math.min(from.length, to.length) >> 1;
  if (n === 0) return null;
  let fx = 0, fy = 0, tx = 0, ty = 0;
  for (let i = 0; i < n; i++) {
    fx += from[2 * i]; fy += from[2 * i + 1]; tx += to[2 * i]; ty += to[2 * i + 1];
  }
  fx /= n; fy /= n; tx /= n; ty /= n;
  // Centered sums: sxx = Σ x², sxy = Σ x·y, and so on, from on the left, to on the right.
  let sxx = 0, sxy = 0, syy = 0, sxu = 0, syu = 0, sxv = 0, syv = 0;
  for (let i = 0; i < n; i++) {
    const x = from[2 * i] - fx, y = from[2 * i + 1] - fy;
    const u = to[2 * i] - tx, v = to[2 * i + 1] - ty;
    sxx += x * x; sxy += x * y; syy += y * y;
    sxu += x * u; syu += y * u; sxv += x * v; syv += y * v;
  }
  const spread = sxx + syy;
  if (spread <= 1e-24) return null;
  const det = sxx * syy - sxy * sxy;
  let a: number, b: number, c: number, d: number;
  if (det > 1e-12 * spread * spread) {
    a = (sxu * syy - syu * sxy) / det;
    c = (syu * sxx - sxu * sxy) / det;
    b = (sxv * syy - syv * sxy) / det;
    d = (syv * sxx - sxv * sxy) / det;
  } else {
    a = (sxu + syv) / spread;
    b = (sxv - syu) / spread;
    c = -b;
    d = a;
  }
  return [a, b, c, d, tx - a * fx - c * fy, ty - b * fx - d * fy];
}
