/** A contour as Bézier segments: evaluating and splitting one, and where one crosses a line. */

import { splitCubicAt, splitQuadraticAt } from '../curve';
import { ringSignedArea } from '../polyline';
import type { Point } from '../paths/cubicMath';

/** A Bézier segment by its control points: 2 = line, 3 = quadratic, 4 = cubic. */
export type Seg = Point[];
export type Contour = Seg[];

/** A point on a contour: segment index and parameter. */
export interface Station {
  seg: number;
  t: number;
  pt: Point;
}

export function evalSeg(s: Seg, t: number): Point {
  const u = 1 - t;
  if (s.length === 2) return { x: u * s[0].x + t * s[1].x, y: u * s[0].y + t * s[1].y };
  if (s.length === 3) {
    const a = u * u, b = 2 * u * t, c = t * t;
    return { x: a * s[0].x + b * s[1].x + c * s[2].x, y: a * s[0].y + b * s[1].y + c * s[2].y };
  }
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return {
    x: a * s[0].x + b * s[1].x + c * s[2].x + d * s[3].x,
    y: a * s[0].y + b * s[1].y + c * s[2].y + d * s[3].y,
  };
}

export function derivSeg(s: Seg, t: number): Point {
  const n = s.length - 1;
  const d: Seg = [];
  for (let i = 0; i < n; i++) d.push({ x: n * (s[i + 1].x - s[i].x), y: n * (s[i + 1].y - s[i].y) });
  return d.length === 1 ? d[0] : evalSeg(d, t);
}

function splitSeg(s: Seg, t: number): [Seg, Seg] {
  const pts = (c: ArrayLike<number>): Seg => {
    const out: Seg = [];
    for (let i = 0; i < c.length; i += 2) out.push({ x: c[i], y: c[i + 1] });
    return out;
  };
  if (s.length === 2) {
    const m = evalSeg(s, t);
    return [[s[0], m], [m, s[1]]];
  }
  if (s.length === 3) {
    const [l, r] = splitQuadraticAt(s[0].x, s[0].y, s[1].x, s[1].y, s[2].x, s[2].y, t);
    return [pts(l), pts(r)];
  }
  const [l, r] = splitCubicAt(s[0].x, s[0].y, s[1].x, s[1].y, s[2].x, s[2].y, s[3].x, s[3].y, t);
  return [pts(l), pts(r)];
}

/** The part of `s` between t0 and t1, with its ends snapped to the given points. */
export function subSeg(s: Seg, t0: number, t1: number, p0: Point, p1: Point): Seg | null {
  if (t1 - t0 <= 0) return null;
  let out = s;
  if (t0 > 0) out = splitSeg(out, t0)[1];
  const u = (t1 - t0) / (1 - t0);
  if (u < 1) out = splitSeg(out, u)[0];
  out = out.slice();
  out[0] = p0;
  out[out.length - 1] = p1;
  return out;
}

export const reverseContour = (c: Contour): Contour => c.map((s) => s.slice().reverse()).reverse();

/** Points along a contour for area and containment estimates. */
export function sampleContour(c: Contour): number[] {
  const out: number[] = [];
  for (const s of c) {
    const n = s.length === 2 ? 1 : 16;
    for (let i = 0; i < n; i++) {
      const p = evalSeg(s, i / n);
      out.push(p.x, p.y);
    }
  }
  return out;
}

/** Signed area; positive when the fill lies to the left of the direction of travel. */
export function signedArea(c: Contour): number {
  return ringSignedArea(sampleContour(c));
}

/** Bernstein coefficients of the signed distance cross(d, P − o) along `s`. */
export function sideCoeffs(s: Seg, o: Point, d: Point): number[] {
  return s.map((p) => d.x * (p.y - o.y) - d.y * (p.x - o.x));
}

function bernstein(f: number[], t: number): number {
  const u = 1 - t;
  if (f.length === 2) return u * f[0] + t * f[1];
  if (f.length === 3) return u * u * f[0] + 2 * u * t * f[1] + t * t * f[2];
  return u * u * u * f[0] + 3 * u * u * t * f[1] + 3 * u * t * t * f[2] + t * t * t * f[3];
}

interface SignChange { t: number; before: number; after: number }

/**
 * Where the polynomial changes sign on [0, 1]. The interval is cut at the
 * derivative's roots so each piece is monotonic, then each sign change is
 * bisected. Tangencies have no sign change and are skipped. With
 * `zeroIsPositive` a zero counts as positive, so a change landing exactly on
 * an end is still seen once; otherwise zeros at the ends are left to the
 * caller.
 */
export function signChanges(f: number[], zeroIsPositive: boolean): SignChange[] {
  const sgn = (v: number) => (v > 0 ? 1 : v < 0 ? -1 : zeroIsPositive ? 1 : 0);
  const cuts = [0, ...criticalPoints(f), 1];
  const out: SignChange[] = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    let lo = cuts[i], hi = cuts[i + 1];
    const slo = sgn(bernstein(f, lo)), shi = sgn(bernstein(f, hi));
    if (slo === 0 && i > 0) {
      const before = sgn(bernstein(f, lo - 1e-7)), after = sgn(bernstein(f, lo + 1e-7));
      if (before * after < 0) out.push({ t: lo, before, after });
    }
    if (slo * shi >= 0) continue;
    for (let it = 0; it < 64; it++) {
      const mid = (lo + hi) / 2;
      if (sgn(bernstein(f, mid)) === slo) lo = mid; else hi = mid;
    }
    out.push({ t: (lo + hi) / 2, before: slo, after: shi });
  }
  return out;
}

/** Roots in (0, 1) of the derivative of a Bernstein polynomial of degree ≤ 3. */
function criticalPoints(f: number[]): number[] {
  if (f.length < 3) return [];
  const n = f.length - 1;
  const d = f.slice(1).map((v, i) => n * (v - f[i]));
  // Power basis of the derivative: A t² + B t + C.
  let A = 0, B: number, C: number;
  if (d.length === 2) { B = d[1] - d[0]; C = d[0]; }
  else { A = d[0] - 2 * d[1] + d[2]; B = 2 * (d[1] - d[0]); C = d[0]; }
  const out: number[] = [];
  const scale = Math.max(Math.abs(A), Math.abs(B), Math.abs(C)) || 1;
  if (Math.abs(A) / scale < 1e-12) {
    if (Math.abs(B) / scale > 1e-12) out.push(-C / B);
  } else {
    const disc = B * B - 4 * A * C;
    if (disc >= 0) {
      const q = -0.5 * (B + Math.sign(B || 1) * Math.sqrt(disc));
      out.push(q / A);
      if (q !== 0) out.push(C / q);
    }
  }
  return out.filter((t) => t > 0 && t < 1).sort((x, y) => x - y);
}

/** Sign of f just after t = 0 (`fromStart`) or just before t = 1, read off the control values. */
export function endSide(f: number[], fromStart: boolean): number {
  const n = f.length;
  for (let i = 1; i < n; i++) {
    const v = fromStart ? f[i] : f[n - 1 - i];
    if (v !== 0) return Math.sign(v);
  }
  return 0;
}
