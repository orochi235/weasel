/**
 * Distinguished points on one Bézier segment: its middle by length, where its
 * tangent turns horizontal or vertical, and where a line from an outside
 * point meets it at a tangent or at a right angle.
 */

import type { Point } from '../paths/cubicMath';
import { evalSeg, derivSeg, type Seg } from '../booleans/contourSegments';
import { segmentLength, segmentTAtLength } from '../paths/segmentLength';

/** The parameter at the middle of `s` by arc length. */
export function segmentMidT(s: Seg): number {
  if (s.length === 2) return 0.5;
  return segmentTAtLength(s, segmentLength(s) / 2);
}

/** Roots of a quadratic a t² + b t + c in [0, 1]. */
function unitQuadraticRoots(a: number, b: number, c: number): number[] {
  const inside = (t: number) => t >= -1e-9 && t <= 1 + 1e-9;
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) < 1e-12) return [];
    const t = -c / b;
    return inside(t) ? [Math.min(1, Math.max(0, t))] : [];
  }
  const disc = b * b - 4 * a * c;
  if (disc < 0) return [];
  const r = Math.sqrt(disc);
  return [(-b - r) / (2 * a), (-b + r) / (2 * a)].filter(inside).map((t) => Math.min(1, Math.max(0, t)));
}

/** Parameters on a curved segment, its ends included, where its tangent is
 *  horizontal or vertical — the local extremes in x or y. None on a line. */
export function segmentExtremaT(s: Seg): number[] {
  if (s.length === 2) return [];
  const n = s.length - 1;
  // Derivative control points, then the derivative in power form per axis.
  const d: Point[] = [];
  for (let i = 0; i < n; i++) d.push({ x: n * (s[i + 1].x - s[i].x), y: n * (s[i + 1].y - s[i].y) });
  const axis = (k: 'x' | 'y'): number[] => d.length === 2
    ? unitQuadraticRoots(0, d[1][k] - d[0][k], d[0][k])
    : unitQuadraticRoots(d[0][k] - 2 * d[1][k] + d[2][k], 2 * (d[1][k] - d[0][k]), d[0][k]);
  return [...axis('x'), ...axis('y')].sort((p, q) => p - q);
}

/** Roots of `f` on [0, 1]: sign changes between samples, closed by bisection. */
function rootsOn(f: (t: number) => number, samples = 48): number[] {
  const out: number[] = [];
  let t0 = 0, f0 = f(0);
  if (f0 === 0) out.push(0);
  for (let k = 1; k <= samples; k++) {
    const t1 = k / samples, f1 = f(t1);
    if (f1 === 0) out.push(t1);
    else if (f0 !== 0 && (f0 < 0) !== (f1 < 0)) {
      let lo = t0, hi = t1, flo = f0;
      for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2, fm = f(mid);
        if ((fm < 0) === (flo < 0)) { lo = mid; flo = fm; } else hi = mid;
      }
      out.push((lo + hi) / 2);
    }
    t0 = t1; f0 = f1;
  }
  return out;
}

/** Parameters where a line from `o` touches curved segment `s` at a tangent.
 *  None on a line, whose tangent is everywhere its own direction. */
export function tangentTsFrom(s: Seg, o: Point): number[] {
  if (s.length === 2) return [];
  return rootsOn((t) => {
    const p = evalSeg(s, t), d = derivSeg(s, t);
    return (p.x - o.x) * d.y - (p.y - o.y) * d.x;
  });
}

/** Parameters where a line from `o` meets `s` at a right angle: the feet of
 *  the perpendiculars dropped from `o`, ends of the segment excepted unless
 *  the right angle falls exactly there. */
export function perpendicularTsFrom(s: Seg, o: Point): number[] {
  return rootsOn((t) => {
    const p = evalSeg(s, t), d = derivSeg(s, t);
    return (p.x - o.x) * d.x + (p.y - o.y) * d.y;
  });
}
