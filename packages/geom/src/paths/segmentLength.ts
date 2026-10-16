/** Measuring one Bézier segment by arc length, and finding where a run of it ends. */

import { derivSeg, type Seg } from '../booleans/contourSegments';

const GL_X = [-0.9602898564975363, -0.7966664774136267, -0.5255324099163290, -0.1834346424956498,
  0.1834346424956498, 0.5255324099163290, 0.7966664774136267, 0.9602898564975363];
const GL_W = [0.1012285362903763, 0.2223810344533745, 0.3137066458778873, 0.3626837833783620,
  0.3626837833783620, 0.3137066458778873, 0.2223810344533745, 0.1012285362903763];

const speed = (s: Seg, t: number): number => {
  const d = derivSeg(s, t);
  return Math.hypot(d.x, d.y);
};

/** Length of `s` between parameters `a` and `b`, by Gauss–Legendre over
 *  eight panels. */
export function segmentLength(s: Seg, a = 0, b = 1): number {
  if (s.length === 2) return speed(s, 0) * (b - a);
  const panels = 8, h = (b - a) / panels;
  let sum = 0;
  for (let k = 0; k < panels; k++) {
    const mid = a + (k + 0.5) * h;
    for (let i = 0; i < GL_X.length; i++) sum += GL_W[i] * speed(s, mid + GL_X[i] * h / 2);
  }
  return sum * h / 2;
}

/** The parameter at which `s` has run `length` from its start, clamped to
 *  0..1: Newton steps on the arc length, held inside a shrinking bracket. */
export function segmentTAtLength(s: Seg, length: number): number {
  const total = segmentLength(s);
  if (length <= 0 || !(total > 0)) return 0;
  if (length >= total) return 1;
  if (s.length === 2) return length / total;
  let lo = 0, hi = 1, t = length / total;
  for (let i = 0; i < 30; i++) {
    const err = segmentLength(s, 0, t) - length;
    if (Math.abs(err) < 1e-10 * Math.max(1, total)) break;
    if (err > 0) hi = t; else lo = t;
    const v = speed(s, t);
    let next = v > 0 ? t - err / v : NaN;
    if (!(next > lo && next < hi)) next = (lo + hi) / 2;
    t = next;
  }
  return t;
}
