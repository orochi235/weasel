/** Measuring one Bézier segment by arc length, and finding where a run of it ends. */

const GL_X = [-0.9602898564975363, -0.7966664774136267, -0.5255324099163290, -0.1834346424956498,
  0.1834346424956498, 0.5255324099163290, 0.7966664774136267, 0.9602898564975363];
const GL_W = [0.1012285362903763, 0.2223810344533745, 0.3137066458778873, 0.3626837833783620,
  0.3626837833783620, 0.3137066458778873, 0.2223810344533745, 0.1012285362903763];

const G4_X = [-0.8611363115940526, -0.3399810435848563, 0.3399810435848563, 0.8611363115940526];
const G4_W = [0.3478548451374538, 0.6521451548625461, 0.6521451548625461, 0.3478548451374538];

/** How far the eight-point rule may sit from the four-point one on a panel, as a share of the
 *  segment's size, before the panel is refined: a cusp's kink is the case that trips it. */
const PANEL_AGREE = 1e-9;
/** How closely a refined panel's halves must agree, as a share of the segment's size. */
const SETTLE = 1e-13;

/** The speed of the segment at `t`: the length of its derivative. */
function speed(c: ArrayLike<number>, dim: number, t: number): number {
  const n = c.length / dim - 1;
  const u = 1 - t;
  let sum = 0;
  for (let k = 0; k < dim; k++) {
    const d0 = c[dim + k] - c[k];
    const v = n === 1 ? d0
      : n === 2 ? 2 * (u * d0 + t * (c[2 * dim + k] - c[dim + k]))
        : 3 * (u * u * d0 + 2 * u * t * (c[2 * dim + k] - c[dim + k]) + t * t * (c[3 * dim + k] - c[2 * dim + k]));
    sum += v * v;
  }
  return Math.sqrt(sum);
}

function rule(c: ArrayLike<number>, dim: number, a: number, b: number, xs: readonly number[], ws: readonly number[]): number {
  const mid = (a + b) / 2, half = (b - a) / 2;
  let sum = 0;
  for (let i = 0; i < xs.length; i++) sum += ws[i] * speed(c, dim, mid + xs[i] * half);
  return sum * half;
}

/** `whole`, the eight-point length over `a..b`, refined by halves until they agree within `tol`.
 *  A difference that is not a number counts as settled. */
function refined(c: ArrayLike<number>, dim: number, a: number, b: number, whole: number, tol: number, depth: number): number {
  const m = (a + b) / 2;
  const l = rule(c, dim, a, m, GL_X, GL_W), r = rule(c, dim, m, b, GL_X, GL_W);
  if (depth >= 20 || !(Math.abs(l + r - whole) > tol)) return l + r;
  return refined(c, dim, a, m, l, tol, depth + 1) + refined(c, dim, m, b, r, tol, depth + 1);
}

/** The length of the control polygon: the segment's own size, which tolerances scale by. */
function hullLength(c: ArrayLike<number>, dim: number): number {
  let sum = 0;
  for (let i = dim; i < c.length; i += dim) {
    let d2 = 0;
    for (let k = 0; k < dim; k++) d2 += (c[i + k] - c[i - dim + k]) ** 2;
    sum += Math.sqrt(d2);
  }
  return sum;
}

function finite(c: ArrayLike<number>): boolean {
  for (let i = 0; i < c.length; i++) if (!Number.isFinite(c[i])) return false;
  return true;
}

/**
 * Length of a Bézier segment between parameters `a` and `b`, by Gauss–Legendre
 * over eight panels; a panel where the eight- and four-point rules disagree is
 * halved until it settles. `coords` holds its control points flat, `dim`
 * components each: two points for a line, three for a quadratic, four for a
 * cubic. NaN when a coordinate is not finite.
 */
export function segmentLength(coords: ArrayLike<number>, dim: 2 | 3, a = 0, b = 1): number {
  if (!finite(coords)) return NaN;
  if (coords.length === 2 * dim) return speed(coords, dim, 0) * (b - a);
  const size = hullLength(coords, dim);
  const panels = 8, h = (b - a) / panels;
  let sum = 0;
  for (let k = 0; k < panels; k++) {
    const p0 = a + k * h, p1 = p0 + h;
    const g8 = rule(coords, dim, p0, p1, GL_X, GL_W);
    const g4 = rule(coords, dim, p0, p1, G4_X, G4_W);
    sum += Math.abs(g8 - g4) > PANEL_AGREE * size ? refined(coords, dim, p0, p1, g8, SETTLE * size, 0) : g8;
  }
  return sum;
}

/**
 * The parameter at which the segment {@link segmentLength} reads has run
 * `length` from its start, clamped to 0..1: Newton steps on the arc length,
 * held inside a shrinking bracket. `total` is its whole length, when the
 * caller has it. 0 when a coordinate is not finite, as for a segment of no length.
 */
export function segmentTAtLength(
  coords: ArrayLike<number>, dim: 2 | 3, length: number, total = segmentLength(coords, dim),
): number {
  if (length <= 0 || !(total > 0) || !Number.isFinite(total)) return 0;
  if (length >= total) return 1;
  if (coords.length === 2 * dim) return length / total;
  let lo = 0, hi = 1, t = length / total;
  for (let i = 0; i < 30; i++) {
    const err = segmentLength(coords, dim, 0, t) - length;
    if (Math.abs(err) < 1e-10 * total) break;
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
