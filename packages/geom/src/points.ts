/**
 * Points and segments over plain number arrays, in any dimension: how far
 * apart two points are, the point part of the way between them, and the
 * nearest point of a segment.
 *
 * Published as is from `./nd`. The 2D barrel states the same rules over loose
 * scalars in `./points2` (they run per pointermove and per vertex, so they
 * must not allocate), and `./3d` wraps these in `Vec3`. Both use the scalar
 * `lerp` and `segmentTFrom` below, so the tiers return the same numbers.
 */

import { lerp as lerpScalar } from './scalar';

/** Squared distance between two points. Compare with this and skip the root. */
export function distance2(a: readonly number[], b: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i]! - b[i]!;
    s += d * d;
  }
  return s;
}

/** Euclidean distance between two points. */
export function distance(a: readonly number[], b: readonly number[]): number {
  return Math.sqrt(distance2(a, b));
}

/** The point `t` of the way from `a` to `b`; `t` outside [0, 1] extrapolates. */
export function lerp(a: readonly number[], b: readonly number[], t: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < a.length; i++) out.push(lerpScalar(a[i]!, b[i]!, t));
  return out;
}

/** The segment parameter from `w·v` and `v·v`, where `v` runs along the
 *  segment and `w` from its start to the point: clamped to [0, 1], and 0 on a
 *  zero-length segment. Shared with `./points2`; not public. */
export function segmentTFrom(wv: number, vv: number): number {
  if (!(vv > 0)) return 0;
  const t = wv / vv;
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** The parameter, 0 to 1, of the point of segment `a`–`b` nearest `p`. A
 *  zero-length segment answers 0. */
export function segmentT(p: readonly number[], a: readonly number[], b: readonly number[]): number {
  let wv = 0;
  let vv = 0;
  for (let i = 0; i < a.length; i++) {
    const v = b[i]! - a[i]!;
    wv += (p[i]! - a[i]!) * v;
    vv += v * v;
  }
  return segmentTFrom(wv, vv);
}

/** The point of segment `a`–`b` nearest `p`. At `t = 1` it is `b` exactly,
 *  not `a + (b - a)`, which can miss it by rounding. */
export function closestPointOnSegment(
  p: readonly number[],
  a: readonly number[],
  b: readonly number[],
): number[] {
  const t = segmentT(p, a, b);
  return t === 1 ? b.slice() : lerp(a, b, t);
}

/** Squared distance from `p` to segment `a`–`b`. */
export function pointSegmentDist2(p: readonly number[], a: readonly number[], b: readonly number[]): number {
  return distance2(p, closestPointOnSegment(p, a, b));
}

/** Distance from `p` to segment `a`–`b`. */
export function pointSegmentDist(p: readonly number[], a: readonly number[], b: readonly number[]): number {
  return Math.sqrt(pointSegmentDist2(p, a, b));
}
