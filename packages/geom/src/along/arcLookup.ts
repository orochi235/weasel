/** Repeated arc-length queries on one curved segment, answered from a table built once per segment. */
import {
  dipNear, dipsFor, finite, G4_W, G4_X, GL_W, GL_X, hullLength, lengthOver, PANEL_AGREE, speedDips, type Dip,
} from '../paths/segmentLength';

const STEPS = 16;
/** How closely the four-point rule must match the eight-point one over a whole step, as a share of the
 *  segment's size, to stand in for it inside the step: far below the tolerance a query is solved to. */
const FOUR_AGREE = 1e-13;
/** What measures a length inside a step: `segmentLength`'s refining rule, the eight-point rule, or the four-point one. */
const REFINED = 0, EIGHT = 1, FOUR = 2;
// Read once: a transpiler's CommonJS output reads an imported binding through a getter, eight times a query.
const X8 = GL_X, W8 = GL_W;
const X4_NEAR = G4_X[2], X4_FAR = G4_X[3], W4_NEAR = G4_W[2], W4_FAR = G4_W[3];
/** How far below the tolerance the bend must bound a Newton step's remaining error for the step to stand unmeasured. */
const SURE = 1e-2;

/** A curved segment's exact arc length at evenly spaced parameters: what repeated length queries on one segment start from. */
export interface ArcLookup {
  /** The length from the start to parameter `k / 16`, `k` = 0..16. */
  readonly s: Float64Array;
  /** The speed at parameter `k / 16`. */
  readonly v: Float64Array;
  /** Per step, how a length inside it is measured: refined where a dip is near or the rules disagree, else by
   *  the four-point rule where it matches the eight-point one, else by the eight-point rule alone. */
  readonly rule: Uint8Array;
  /** The derivative as a polynomial, per component its t², t and constant coefficients. */
  readonly der: Float64Array;
  readonly size: number;
  readonly dips: readonly Dip[];
}

/** The derivative of Bézier `c` as `dim` (t², t, 1) coefficient triples. */
function derivative(c: ArrayLike<number>, dim: number): Float64Array {
  const n = c.length / dim - 1;
  const der = new Float64Array(3 * dim);
  for (let k = 0; k < dim; k++) {
    const d0 = c[dim + k] - c[k];
    if (n === 1) {
      der[3 * k + 2] = d0;
    } else if (n === 2) {
      const d1 = c[2 * dim + k] - c[dim + k];
      der[3 * k + 1] = 2 * (d1 - d0);
      der[3 * k + 2] = 2 * d0;
    } else {
      const d1 = c[2 * dim + k] - c[dim + k];
      const d2 = c[3 * dim + k] - c[2 * dim + k];
      der[3 * k] = 3 * (d0 - 2 * d1 + d2);
      der[3 * k + 1] = 6 * (d1 - d0);
      der[3 * k + 2] = 3 * d0;
    }
  }
  return der;
}

function speedAt(der: Float64Array, dim: number, t: number): number {
  const x = (der[0] * t + der[1]) * t + der[2];
  const y = (der[3] * t + der[4]) * t + der[5];
  if (dim === 2) return Math.sqrt(x * x + y * y);
  const z = (der[6] * t + der[7]) * t + der[8];
  return Math.sqrt(x * x + y * y + z * z);
}

/** The squared length of the second derivative at `t`. */
function bend2At(der: Float64Array, dim: number, t: number): number {
  const x = 2 * der[0] * t + der[1];
  const y = 2 * der[3] * t + der[4];
  if (dim === 2) return x * x + y * y;
  const z = 2 * der[6] * t + der[7];
  return x * x + y * y + z * z;
}

/** The four-point rule over `a..b`, unrolled: what a query inside a step that allows it costs. */
function four(der: Float64Array, dim: number, a: number, b: number): number {
  const mid = (a + b) / 2, half = (b - a) / 2;
  const o0 = X4_FAR * half, o1 = X4_NEAR * half;
  return half * (W4_FAR * (speedAt(der, dim, mid - o0) + speedAt(der, dim, mid + o0))
    + W4_NEAR * (speedAt(der, dim, mid - o1) + speedAt(der, dim, mid + o1)));
}

function gauss(der: Float64Array, dim: number, a: number, b: number, xs: readonly number[], ws: readonly number[]): number {
  const mid = (a + b) / 2, half = (b - a) / 2;
  let sum = 0;
  for (let i = 0; i < xs.length; i++) sum += ws[i] * speedAt(der, dim, mid + xs[i] * half);
  return sum * half;
}

/** @internal The {@link ArcLookup} of curved segment `coords`, each step measured as one panel of `segmentLength`'s rule. */
export function arcLookup(coords: ArrayLike<number>, dim: 2 | 3): ArcLookup {
  const size = hullLength(coords, dim);
  const ok = finite(coords);
  const dips = ok ? speedDips(coords, dim) : [];
  const roots = dipsFor(dips, 1 / STEPS);
  const der = derivative(coords, dim);
  const s = new Float64Array(STEPS + 1);
  const v = new Float64Array(STEPS + 1);
  const rule = new Uint8Array(STEPS);
  for (let k = 0; k < STEPS; k++) {
    const a = k / STEPS, b = (k + 1) / STEPS;
    const g8 = gauss(der, dim, a, b, X8, W8);
    const gap = Math.abs(g8 - gauss(der, dim, a, b, G4_X, G4_W));
    if (ok && !dipNear(roots, a, b) && gap <= PANEL_AGREE * size) {
      rule[k] = gap <= FOUR_AGREE * size ? FOUR : EIGHT;
      s[k + 1] = s[k] + g8;
    } else {
      s[k + 1] = s[k] + lengthOver(coords, dim, a, b, size, dips, 1);
    }
  }
  for (let k = 0; k <= STEPS; k++) v[k] = speedAt(der, dim, k / STEPS);
  return { s, v, rule, der, size, dips };
}

/** The length from step `k`'s start to parameter `t` inside it. */
function within(coords: ArrayLike<number>, dim: 2 | 3, lk: ArcLookup, k: number, t: number): number {
  const r = lk.rule[k];
  const a = k / STEPS;
  if (r === FOUR) return four(lk.der, dim, a, t);
  if (r === EIGHT) return gauss(lk.der, dim, a, t, X8, W8);
  return lengthOver(coords, dim, a, t, lk.size, lk.dips, 1);
}

/** @internal The length from the start of `coords` to parameter `t`, read from its lookup `lk`. */
export function lookupLength(coords: ArrayLike<number>, dim: 2 | 3, lk: ArcLookup, t: number): number {
  const f = Math.min(Math.max(t, 0), 1);
  const k = Math.min(Math.floor(f * STEPS), STEPS - 1);
  return lk.s[k] + within(coords, dim, lk, k, f);
}

/**
 * The share of a step at which the cubic Hermite through its ends' lengths and
 * speeds reaches `length`, by one Newton step on it from the linear guess: a
 * first guess close enough that one Newton step on the exact length usually
 * finishes. `rise` is the step's length and `m0`, `m1` its end speeds scaled to the step.
 */
function hermiteShare(rise: number, m0: number, m1: number, length: number): number {
  if (!(rise > 0)) return 0;
  const c2 = 3 * rise - 2 * m0 - m1, c3 = m0 + m1 - 2 * rise;
  const u = length / rise;
  const d = m0 + u * (2 * c2 + 3 * c3 * u);
  if (!(d > 0)) return u;
  return Math.min(Math.max(u - (u * (m0 + u * (c2 + c3 * u)) - length) / d, 0), 1);
}

/**
 * @internal `segmentTAtLength` from a lookup: the step holding `length` gives
 * the bracket, a Hermite fit through its ends the first guess, and Newton
 * steps on one panel's length finish it. Away from a dip, a Newton step
 * whose remaining error the curve's bend bounds below the tolerance is taken
 * without measuring again.
 */
export function lookupT(coords: ArrayLike<number>, dim: 2 | 3, lk: ArcLookup, length: number): number {
  const { s, v, der } = lk;
  const total = s[STEPS];
  if (length <= 0 || !(total > 0) || !Number.isFinite(total)) return 0;
  if (length >= total) return 1;
  let k = 0;
  let hi = STEPS - 1;
  while (k < hi) {
    const mid = (k + hi + 1) >> 1;
    if (s[mid] <= length) k = mid;
    else hi = mid - 1;
  }
  const a = k / STEPS;
  const flat = lk.rule[k] !== REFINED;
  const tol = 1e-10 * total;
  let lo = a, top = (k + 1) / STEPS;
  const t = a + hermiteShare(s[k + 1] - s[k], v[k] / STEPS, v[k + 1] / STEPS, length - s[k]) / STEPS;
  // One measured Newton step nearly always finishes; it stays out of the loop, which costs half again as much.
  const err = s[k] + (lk.rule[k] === FOUR ? four(der, dim, a, t) : within(coords, dim, lk, k, t)) - length;
  const dt = err / speedAt(der, dim, t);
  const next = t - dt;
  const inside = next > lo && next < top;
  if (inside) {
    if (Math.abs(err) < tol) return next;
    // The step leaves an error of half the speed's change times dt², and the speed changes no faster than the bend.
    const dt2 = dt * dt, cap = SURE * tol;
    if (flat && bend2At(der, dim, t) * dt2 * dt2 < cap * cap) return next;
  } else if (Math.abs(err) < tol) {
    return t;
  }
  if (err > 0) top = t; else lo = t;
  return settle(coords, dim, lk, k, length, inside ? next : (lo + top) / 2, lo, top);
}

/** {@link lookupT}'s Newton steps from `t`, held inside `lo..top` in step `k`, each measured. */
function settle(
  coords: ArrayLike<number>, dim: 2 | 3, lk: ArcLookup, k: number, length: number, t: number, lo: number, top: number,
): number {
  const tol = 1e-10 * lk.s[STEPS];
  for (let i = 0; i < 30; i++) {
    const err = lk.s[k] + within(coords, dim, lk, k, t) - length;
    const sp = speedAt(lk.der, dim, t);
    const next = sp > 0 ? t - err / sp : NaN;
    const inside = next > lo && next < top;
    if (Math.abs(err) < tol) return inside ? next : t;
    if (err > 0) top = t; else lo = t;
    t = inside ? next : (lo + top) / 2;
  }
  return t;
}
