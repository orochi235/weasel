/**
 * Euclidean distance transform for runtime SDF glyph baking (the TinySDF
 * technique): antialiased canvas coverage in → single-channel SDF bytes out.
 *
 * Uses Felzenszwalb & Huttenlocher's 1D squared-distance transform applied
 * along columns then rows. Pure JS, no dependencies, no allocation beyond
 * the work arrays sized to the input.
 */

const INF = 1e20;

/** One 1D pass of the squared EDT (Felzenszwalb & Huttenlocher 2012, §2). */
function edt1d(
  f: Float64Array, d: Float64Array, v: Int32Array, z: Float64Array, n: number,
): void {
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  let k = 0;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

/** In-place 2D squared EDT over `grid` (width × height): columns, then rows. */
function edt2d(
  grid: Float64Array, width: number, height: number,
  f: Float64Array, d: Float64Array, v: Int32Array, z: Float64Array,
): void {
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) f[y] = grid[y * width + x];
    edt1d(f, d, v, z, height);
    for (let y = 0; y < height; y++) grid[y * width + x] = d[y];
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) f[x] = grid[y * width + x];
    edt1d(f, d, v, z, width);
    for (let x = 0; x < width; x++) grid[y * width + x] = d[x];
  }
}

/**
 * Convert an alpha-coverage bitmap (0–255) to single-channel SDF bytes.
 * Signed distance is positive outside the shape; the output maps it as
 * `255 − 255·(dist/radius + cutoff)` clamped to [0,255], so with
 * cutoff 0.5 the shape edge lands at byte ~128 (shader threshold 0.5).
 */
export function alphaToSdf(
  alpha: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  radius: number,
  cutoff: number,
): Uint8Array {
  const n = width * height;
  const gridOuter = new Float64Array(n);
  const gridInner = new Float64Array(n);
  const size = Math.max(width, height);
  const f = new Float64Array(size);
  const d = new Float64Array(size);
  const v = new Int32Array(size);
  const z = new Float64Array(size + 1);

  for (let i = 0; i < n; i++) {
    const a = alpha[i] / 255;
    gridOuter[i] = a === 1 ? 0 : a === 0 ? INF : Math.max(0, 0.5 - a) ** 2;
    gridInner[i] = a === 1 ? INF : a === 0 ? 0 : Math.max(0, a - 0.5) ** 2;
  }
  edt2d(gridOuter, width, height, f, d, v, z);
  edt2d(gridInner, width, height, f, d, v, z);

  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const dist = Math.sqrt(gridOuter[i]) - Math.sqrt(gridInner[i]);
    const byte = Math.round(255 - 255 * (dist / radius + cutoff));
    out[i] = byte < 0 ? 0 : byte > 255 ? 255 : byte;
  }
  return out;
}
