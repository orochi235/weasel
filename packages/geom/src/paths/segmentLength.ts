/** Measuring one Bézier segment by arc length, and finding where a run of it ends. */

const GL_X = [-0.9602898564975363, -0.7966664774136267, -0.5255324099163290, -0.1834346424956498,
  0.1834346424956498, 0.5255324099163290, 0.7966664774136267, 0.9602898564975363];
const GL_W = [0.1012285362903763, 0.2223810344533745, 0.3137066458778873, 0.3626837833783620,
  0.3626837833783620, 0.3137066458778873, 0.2223810344533745, 0.1012285362903763];

/** The speed of the segment at `t`: the length of its derivative, by de Casteljau on the derivative's controls. */
function speed(c: ArrayLike<number>, dim: number, t: number): number {
  const n = c.length / dim - 1;
  let sum = 0;
  for (let k = 0; k < dim; k++) {
    const d: number[] = [];
    for (let i = 0; i < n; i++) d.push(n * (c[(i + 1) * dim + k] - c[i * dim + k]));
    for (let m = d.length - 1; m > 0; m--) for (let i = 0; i < m; i++) d[i] += (d[i + 1] - d[i]) * t;
    sum += d[0] * d[0];
  }
  return Math.sqrt(sum);
}

/** Eight-point Gauss–Legendre over `a..b`. */
function gauss(c: ArrayLike<number>, dim: number, a: number, b: number): number {
  const mid = (a + b) / 2, half = (b - a) / 2;
  let sum = 0;
  for (let i = 0; i < GL_X.length; i++) sum += GL_W[i] * speed(c, dim, mid + GL_X[i] * half);
  return sum * half;
}

/** `whole`, the Gauss–Legendre length over `a..b`, refined by halves until they agree. A
 *  cusp, where the speed has a kink, is where one rule over a panel is measurably off. */
function refined(c: ArrayLike<number>, dim: number, a: number, b: number, whole: number, depth: number): number {
  const m = (a + b) / 2;
  const l = gauss(c, dim, a, m), r = gauss(c, dim, m, b);
  if (depth >= 20 || Math.abs(l + r - whole) <= 1e-12 * Math.max(1, whole)) return l + r;
  return refined(c, dim, a, m, l, depth + 1) + refined(c, dim, m, b, r, depth + 1);
}

/**
 * Length of a Bézier segment between parameters `a` and `b`, by Gauss–Legendre
 * over eight panels, each halved until it settles. `coords` holds its control
 * points flat, `dim` components each: two points for a line, three for a
 * quadratic, four for a cubic.
 */
export function segmentLength(coords: ArrayLike<number>, dim: 2 | 3, a = 0, b = 1): number {
  if (coords.length === 2 * dim) return speed(coords, dim, 0) * (b - a);
  const panels = 8, h = (b - a) / panels;
  let sum = 0;
  for (let k = 0; k < panels; k++) {
    const p0 = a + k * h;
    sum += refined(coords, dim, p0, p0 + h, gauss(coords, dim, p0, p0 + h), 0);
  }
  return sum;
}

/** The parameter at which the segment {@link segmentLength} reads has run
 *  `length` from its start, clamped to 0..1: Newton steps on the arc length,
 *  held inside a shrinking bracket. */
export function segmentTAtLength(coords: ArrayLike<number>, dim: 2 | 3, length: number): number {
  const total = segmentLength(coords, dim);
  if (length <= 0 || !(total > 0)) return 0;
  if (length >= total) return 1;
  if (coords.length === 2 * dim) return length / total;
  let lo = 0, hi = 1, t = length / total;
  for (let i = 0; i < 30; i++) {
    const err = segmentLength(coords, dim, 0, t) - length;
    if (Math.abs(err) < 1e-10 * Math.max(1, total)) break;
    if (err > 0) hi = t; else lo = t;
    const v = speed(coords, dim, t);
    let next = v > 0 ? t - err / v : NaN;
    if (!(next > lo && next < hi)) next = (lo + hi) / 2;
    t = next;
  }
  return t;
}

/** `pts` as the flat 2D coords {@link segmentLength} reads. */
export const flatPoints = (pts: readonly { x: number; y: number }[]): number[] => pts.flatMap((p) => [p.x, p.y]);
