/**
 * One spiral segment, fitted between two points so it leaves the first and
 * reaches the second at given angles to the chord. `solveSpiro` joins these
 * into a curvature-continuous spline.
 *
 * In its normalized frame the segment has unit arc length and, with
 * `u = s − ½`, tangent angle `φ = k0·u + (k1/2)·u² + (k2/6)·u³ + (k3/24)·u⁴`,
 * so its curvature is `k0 + k1·u + (k2/2)·u² + (k3/6)·u³`. An Euler spiral has
 * `k2 = k3 = 0`: its curvature changes linearly along it. A cubic-curvature
 * segment uses all four, which is what lets a G4 point keep the curvature's
 * first two derivatives continuous as well.
 */
import type { Point } from './cubicMath';

/** The shape of a fitted segment, in its normalized frame. */
export interface EulerFit {
  k0: number;
  k1: number;
  /** Zero on an Euler spiral; set on a cubic-curvature segment. */
  k2: number;
  k3: number;
  /** Chord over arc length: the normalized segment's chord length. */
  ratio: number;
  /** The normalized chord's angle, which the world chord is rotated onto. */
  chordAngle: number;
}

/** Steps of the Simpson rule that integrates a segment's tangent. Even. */
const STEPS = 48;
/** A chord-relative angle past this has no sensible spiral. */
const MAX_ANGLE = Math.PI * 0.95;

const clampAngle = (a: number): number => Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, a));

/** `∫₀^upTo e^{iφ(s)} ds` for the normalized segment `(k0, k1, k2, k3)`. */
export function integrateEuler(k0: number, k1: number, upTo = 1, k2 = 0, k3 = 0): Point {
  const n = Math.max(2, Math.ceil((STEPS * upTo) / 2) * 2);
  const h = upTo / n;
  let x = 0;
  let y = 0;
  for (let i = 0; i <= n; i++) {
    const u = i * h - 0.5;
    const phi = k0 * u + u * u * (k1 / 2 + u * (k2 / 6 + (u * k3) / 24));
    const w = i === 0 || i === n ? 1 : i % 2 === 1 ? 4 : 2;
    x += w * Math.cos(phi);
    y += w * Math.sin(phi);
  }
  return { x: (x * h) / 3, y: (y * h) / 3 };
}

/** How far the start angle of `(k0, k1, k2, k3)` is from `th0`. */
function startError(k0: number, k1: number, k2: number, k3: number, th0: number): number {
  const c = integrateEuler(k0, k1, 1, k2, k3);
  return -k0 / 2 + k1 / 8 - k2 / 48 + k3 / 384 - Math.atan2(c.y, c.x) - th0;
}

/**
 * The spiral leaving its chord at angle `th0` and reaching the far end at
 * angle `th1`, both measured from the chord, counterclockwise positive. With
 * `k2` and `k3` left at zero it is an Euler spiral; given, they are the
 * cubic-curvature segment's higher terms, and `k0` and `k1` are fitted around them.
 */
export function fitEulerSegment(th0: number, th1: number, k2 = 0, k3 = 0): EulerFit {
  const t0 = clampAngle(th0);
  const t1 = clampAngle(th1);
  // The odd terms set the total turn; the even ones bow the segment.
  const k0 = t1 - t0 - k2 / 24;
  // The small-angle solution, then Newton on the one remaining unknown.
  let k1 = 6 * (t0 + t1) - k3 / 40;
  for (let iter = 0; iter < 12; iter++) {
    const e = startError(k0, k1, k2, k3, t0);
    if (Math.abs(e) < 1e-12) break;
    const d = (startError(k0, k1 + 1e-6, k2, k3, t0) - e) / 1e-6;
    if (!Number.isFinite(d) || Math.abs(d) < 1e-12) break;
    k1 -= e / d;
  }
  const c = integrateEuler(k0, k1, 1, k2, k3);
  return { k0, k1, k2, k3, ratio: Math.hypot(c.x, c.y), chordAngle: Math.atan2(c.y, c.x) };
}

/** A fitted segment placed between two world points. */
export interface EulerSegment extends EulerFit {
  p0: Point;
  p1: Point;
  /** World arc length. */
  length: number;
  /** The world angle the normalized frame is turned by. */
  rotation: number;
}

/** `fit` placed so it runs from `p0` to `p1`. */
export function placeEulerSegment(fit: EulerFit, p0: Point, p1: Point): EulerSegment {
  const chord = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  const length = fit.ratio > 1e-9 ? chord / fit.ratio : chord;
  const rotation = Math.atan2(p1.y - p0.y, p1.x - p0.x) - fit.chordAngle;
  return { ...fit, p0, p1, length, rotation };
}

/** The point at fraction `s` of the arc length along `seg`. */
export function eulerPointAt(seg: EulerSegment, s: number): Point {
  const c = integrateEuler(seg.k0, seg.k1, s, seg.k2, seg.k3);
  const cos = Math.cos(seg.rotation);
  const sin = Math.sin(seg.rotation);
  return {
    x: seg.p0.x + seg.length * (c.x * cos - c.y * sin),
    y: seg.p0.y + seg.length * (c.x * sin + c.y * cos),
  };
}

/** World tangent angle at fraction `s` of `seg`'s arc length. */
export function eulerAngleAt(seg: EulerSegment, s: number): number {
  const u = s - 0.5;
  return seg.rotation + seg.k0 * u + u * u * (seg.k1 / 2 + u * (seg.k2 / 6 + (u * seg.k3) / 24));
}

/** Normalized curvature at `u = s − ½`. */
const bendAt = (f: EulerFit, u: number): number => f.k0 + u * (f.k1 + u * (f.k2 / 2 + (u * f.k3) / 6));

/** Signed world curvature at fraction `s` of `seg`'s arc length;
 *  positive turns counterclockwise. */
export function eulerCurvatureAt(seg: EulerSegment, s: number): number {
  if (seg.length < 1e-12) return 0;
  return bendAt(seg, s - 0.5) / seg.length;
}

/** The first and second derivatives of `seg`'s world curvature with respect
 *  to world arc length, at fraction `s` of it. */
export function eulerCurvatureDerivativesAt(seg: EulerSegment, s: number): [number, number] {
  if (seg.length < 1e-12) return [0, 0];
  const u = s - 0.5;
  return [
    (seg.k1 + u * (seg.k2 + (u * seg.k3) / 2)) / seg.length ** 2,
    (seg.k2 + u * seg.k3) / seg.length ** 3,
  ];
}

const SAMPLES = 16;

/** Handle lengths `[a, b]` along `u0`, `u1` that best fit `samples` at the
 *  cubic parameters `ts`, by least squares. Null when the fit degenerates. */
function fitHandleLengths(
  p0: Point, p1: Point, u0: Point, u1: Point, samples: readonly Point[], ts: readonly number[],
): [number, number] | null {
  // B(t) = base(t) + a·3(1−t)²t·u0 − b·3(1−t)t²·u1, linear in a and b.
  let m00 = 0, m01 = 0, m11 = 0, r0 = 0, r1 = 0;
  samples.forEach((q, i) => {
    const t = ts[i];
    const mt = 1 - t;
    const b0 = mt * mt * mt + 3 * mt * mt * t;
    const b3 = 3 * mt * t * t + t * t * t;
    const ex = q.x - (b0 * p0.x + b3 * p1.x);
    const ey = q.y - (b0 * p0.y + b3 * p1.y);
    const f1 = 3 * mt * mt * t;
    const f2 = 3 * mt * t * t;
    const ax = f1 * u0.x, ay = f1 * u0.y;
    const bx = -f2 * u1.x, by = -f2 * u1.y;
    m00 += ax * ax + ay * ay;
    m01 += ax * bx + ay * by;
    m11 += bx * bx + by * by;
    r0 += ax * ex + ay * ey;
    r1 += bx * ex + by * ey;
  });
  const det = m00 * m11 - m01 * m01;
  if (Math.abs(det) < 1e-12) return null;
  const a = (r0 * m11 - r1 * m01) / det;
  const b = (m00 * r1 - m01 * r0) / det;
  return a > 0 && b > 0 && Number.isFinite(a) && Number.isFinite(b) ? [a, b] : null;
}

/** One Newton step moving `t` toward the point of the cubic nearest `q`. */
function nearerT(p: readonly Point[], q: Point, t: number): number {
  const mt = 1 - t;
  const at = (c0: number, c1: number, c2: number, c3: number) =>
    mt * mt * mt * c0 + 3 * mt * mt * t * c1 + 3 * mt * t * t * c2 + t * t * t * c3;
  const d1 = (c0: number, c1: number, c2: number, c3: number) =>
    3 * (mt * mt * (c1 - c0) + 2 * mt * t * (c2 - c1) + t * t * (c3 - c2));
  const d2 = (c0: number, c1: number, c2: number, c3: number) =>
    6 * (mt * (c2 - 2 * c1 + c0) + t * (c3 - 2 * c2 + c1));
  const ex = at(p[0].x, p[1].x, p[2].x, p[3].x) - q.x;
  const ey = at(p[0].y, p[1].y, p[2].y, p[3].y) - q.y;
  const dx = d1(p[0].x, p[1].x, p[2].x, p[3].x);
  const dy = d1(p[0].y, p[1].y, p[2].y, p[3].y);
  const ddx = d2(p[0].x, p[1].x, p[2].x, p[3].x);
  const ddy = d2(p[0].y, p[1].y, p[2].y, p[3].y);
  const den = dx * dx + dy * dy + ex * ddx + ey * ddy;
  if (Math.abs(den) < 1e-12) return t;
  return Math.min(1, Math.max(0, t - (ex * dx + ey * dy) / den));
}

/**
 * The two control points of a cubic that follows `seg`: each handle lies on
 * the spiral's tangent at its end, with lengths fitted to points sampled along
 * the spiral by least squares, re-pairing each sample with its nearest cubic
 * parameter between rounds.
 */
export function eulerSegmentCubic(seg: EulerSegment): { c1: Point; c2: Point } {
  const { p0, p1 } = seg;
  const a0 = eulerAngleAt(seg, 0);
  const a1 = eulerAngleAt(seg, 1);
  const u0 = { x: Math.cos(a0), y: Math.sin(a0) };
  const u1 = { x: Math.cos(a1), y: Math.sin(a1) };
  const samples: Point[] = [];
  const ts: number[] = [];
  for (let i = 1; i < SAMPLES; i++) {
    samples.push(eulerPointAt(seg, i / SAMPLES));
    ts.push(i / SAMPLES);
  }
  const chord = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  let lengths: [number, number] = [chord / 3, chord / 3];
  const handles = ([a, b]: [number, number]) => ({
    c1: { x: p0.x + a * u0.x, y: p0.y + a * u0.y },
    c2: { x: p1.x - b * u1.x, y: p1.y - b * u1.y },
  });
  for (let round = 0; round < 4; round++) {
    const fit = fitHandleLengths(p0, p1, u0, u1, samples, ts);
    if (!fit) break;
    lengths = fit;
    const { c1, c2 } = handles(lengths);
    const ctrl = [p0, c1, c2, p1];
    samples.forEach((q, i) => { ts[i] = nearerT(ctrl, q, ts[i]); });
  }
  return handles(lengths);
}

/** The stretch of `seg` from fraction `s0` to `s1` of its arc length, as a
 *  segment of its own: a piece of an Euler spiral is one. */
export function subEulerSegment(seg: EulerSegment, s0: number, s1: number): EulerSegment {
  const d = s1 - s0;
  const m = (s0 + s1) / 2 - 0.5;
  // The curvature polynomial re-centered on the piece and scaled to its length.
  const k0 = bendAt(seg, m) * d;
  const k1 = (seg.k1 + m * (seg.k2 + (m * seg.k3) / 2)) * d ** 2;
  const k2 = (seg.k2 + m * seg.k3) * d ** 3;
  const k3 = seg.k3 * d ** 4;
  const c = integrateEuler(k0, k1, 1, k2, k3);
  const fit: EulerFit = { k0, k1, k2, k3, ratio: Math.hypot(c.x, c.y), chordAngle: Math.atan2(c.y, c.x) };
  return placeEulerSegment(fit, eulerPointAt(seg, s0), eulerPointAt(seg, s1));
}

/** How far the cubic `(seg.p0, c1, c2, seg.p1)` strays from `seg`, measured
 *  at a few points along the spiral. */
export function eulerCubicError(seg: EulerSegment, c1: Point, c2: Point): number {
  const ctrl = [seg.p0, c1, c2, seg.p1];
  let worst = 0;
  for (const s of [0.2, 0.4, 0.5, 0.6, 0.8]) {
    const q = eulerPointAt(seg, s);
    let t = s;
    for (let i = 0; i < 4; i++) t = nearerT(ctrl, q, t);
    const mt = 1 - t;
    const x = mt * mt * mt * seg.p0.x + 3 * mt * mt * t * c1.x + 3 * mt * t * t * c2.x + t * t * t * seg.p1.x;
    const y = mt * mt * mt * seg.p0.y + 3 * mt * mt * t * c1.y + 3 * mt * t * t * c2.y + t * t * t * seg.p1.y;
    worst = Math.max(worst, Math.hypot(x - q.x, y - q.y));
  }
  return worst;
}
