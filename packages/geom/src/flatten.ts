/**
 * Bezier flattening — subdivide cubic and quadratic segments into polyline
 * approximations within a flatness tolerance.
 *
 * The flatness metric is the maximum distance from any control point to the
 * chord between endpoints.
 *
 * Tolerance is in world units. 0.5 is a sensible default for screen-rate
 * rendering at 1× zoom; consumers that zoom in heavily should pass a
 * tighter tolerance.
 */

import { pointSegmentDist } from './points2';

/** The tolerance, in world units, the flatteners use when none is given. */
export const DEFAULT_FLATTEN_TOLERANCE = 0.5;

/** Floor for a non-positive or NaN tolerance. Without it the flatness test can
 *  never be satisfied and the subdivision recurses until the stack blows. */
const MIN_FLATTEN_TOLERANCE = 1e-6;

/** Subdivision ceiling. The tolerance floor bounds the common runaway; this
 *  bounds the other one, coordinates large enough that reaching 1e-6 takes
 *  hundreds of levels. Error falls roughly 4x per level, so 16 is far beyond
 *  any tolerance a caller can mean. */
const MAX_FLATTEN_DEPTH = 16;

function usableTolerance(tolerance: number): number {
  return tolerance > 0 ? tolerance : MIN_FLATTEN_TOLERANCE;
}

function finite6(a: number, b: number, c: number, d: number, e: number, f: number): boolean {
  return Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(c)
    && Number.isFinite(d) && Number.isFinite(e) && Number.isFinite(f);
}

function finite8(
  a: number, b: number, c: number, d: number,
  e: number, f: number, g: number, h: number,
): boolean {
  return finite6(a, b, c, d, e, f) && Number.isFinite(g) && Number.isFinite(h);
}

/** Whether edges `offset` out from a curve stay within `tolerance` of the true
 *  ones when a chord stands in for it. An edge sits on a circle `offset` wider
 *  than the curve's, so it strays by that radius times `1 - cos(turn / 2)`; the
 *  control polygon bounds the turn, and its length over the turn the radius. */
function edgesWithin(
  x0: number, y0: number, x1: number, y1: number,
  x2: number, y2: number, x3: number, y3: number,
  offset: number, tolerance: number,
): boolean {
  let turn = legTurn(x1 - x0, y1 - y0, x2 - x1, y2 - y1)
    + legTurn(x2 - x1, y2 - y1, x3 - x2, y3 - y2);
  if (x2 === x1 && y2 === y1) turn += legTurn(x1 - x0, y1 - y0, x3 - x2, y3 - y2);
  if (turn === 0) return true;
  if (turn >= Math.PI) return false;
  const length = Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2);
  return (length / turn + offset) * (1 - Math.cos(turn / 2)) <= tolerance;
}

/** Angle between two legs; zero when either has no length. */
function legTurn(ax: number, ay: number, bx: number, by: number): number {
  const lens = Math.sqrt((ax * ax + ay * ay) * (bx * bx + by * by));
  if (lens === 0) return 0;
  return Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / lens)));
}

/**
 * Recursively subdivide a cubic bezier (P0..P3) and append `lineTo`-style
 * vertices to `out` (interleaved x,y). The starting endpoint is *not*
 * appended — callers usually emitted it as the segment's previous vertex.
 */
export function flattenCubic(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
  tolerance: number,
  out: number[],
): void {
  if (!finite8(x0, y0, x1, y1, x2, y2, x3, y3)) {
    out.push(x3, y3);
    return;
  }
  flattenCubicRec(x0, y0, x1, y1, x2, y2, x3, y3, usableTolerance(tolerance), out, 0);
}

function flattenCubicRec(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
  tolerance: number,
  out: number[],
  depth: number,
): void {
  const d1 = pointSegmentDist(x1, y1, x0, y0, x3, y3);
  const d2 = pointSegmentDist(x2, y2, x0, y0, x3, y3);
  if (Math.max(d1, d2) <= tolerance || depth >= MAX_FLATTEN_DEPTH) {
    out.push(x3, y3);
    return;
  }
  // De Casteljau split at t=0.5
  const x01 = (x0 + x1) * 0.5, y01 = (y0 + y1) * 0.5;
  const x12 = (x1 + x2) * 0.5, y12 = (y1 + y2) * 0.5;
  const x23 = (x2 + x3) * 0.5, y23 = (y2 + y3) * 0.5;
  const x012 = (x01 + x12) * 0.5, y012 = (y01 + y12) * 0.5;
  const x123 = (x12 + x23) * 0.5, y123 = (y12 + y23) * 0.5;
  const x0123 = (x012 + x123) * 0.5, y0123 = (y012 + y123) * 0.5;
  flattenCubicRec(x0, y0, x01, y01, x012, y012, x0123, y0123, tolerance, out, depth + 1);
  flattenCubicRec(x0123, y0123, x123, y123, x23, y23, x3, y3, tolerance, out, depth + 1);
}

/** Recursively subdivide a quadratic bezier (P0, P1, P2). */
export function flattenQuadratic(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  tolerance: number,
  out: number[],
): void {
  if (!finite6(x0, y0, x1, y1, x2, y2)) {
    out.push(x2, y2);
    return;
  }
  flattenQuadraticRec(x0, y0, x1, y1, x2, y2, usableTolerance(tolerance), out, 0);
}

function flattenQuadraticRec(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  tolerance: number,
  out: number[],
  depth: number,
): void {
  const d = pointSegmentDist(x1, y1, x0, y0, x2, y2);
  if (d <= tolerance || depth >= MAX_FLATTEN_DEPTH) {
    out.push(x2, y2);
    return;
  }
  const x01 = (x0 + x1) * 0.5, y01 = (y0 + y1) * 0.5;
  const x12 = (x1 + x2) * 0.5, y12 = (y1 + y2) * 0.5;
  const x012 = (x01 + x12) * 0.5, y012 = (y01 + y12) * 0.5;
  flattenQuadraticRec(x0, y0, x01, y01, x012, y012, tolerance, out, depth + 1);
  flattenQuadraticRec(x012, y012, x12, y12, x2, y2, tolerance, out, depth + 1);
}

/**
 * Like `flattenCubic` but also appends to `arcOut`, for each new flattened
 * point, its *cumulative distance from the segment start* — not a normalized
 * fraction. The caller divides each by the segment's total flattened arc
 * length to yield t ∈ (0, 1]. With `offset`, each piece is also fine enough
 * that edges that far out from it stay within the tolerance.
 */
export function flattenCubicWithArcLen(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
  tolerance: number,
  out: number[],
  arcOut: number[],
  offset = 0,
): number {
  if (!finite8(x0, y0, x1, y1, x2, y2, x3, y3)) {
    out.push(x3, y3);
    arcOut.push(0);
    return 0;
  }
  return flattenCubicArcRec(x0, y0, x1, y1, x2, y2, x3, y3, usableTolerance(tolerance), offset, out, arcOut, 0, 0);
}

function flattenCubicArcRec(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
  tolerance: number,
  offset: number,
  out: number[],
  arcOut: number[],
  accum: number,
  depth: number,
): number {
  const d1 = pointSegmentDist(x1, y1, x0, y0, x3, y3);
  const d2 = pointSegmentDist(x2, y2, x0, y0, x3, y3);
  const flat = Math.max(d1, d2) <= tolerance
    && (offset === 0 || edgesWithin(x0, y0, x1, y1, x2, y2, x3, y3, offset, tolerance));
  if (flat || depth >= MAX_FLATTEN_DEPTH) {
    const lastX = out.length >= 2 ? out[out.length - 2] : x0;
    const lastY = out.length >= 2 ? out[out.length - 1] : y0;
    const seg = Math.hypot(x3 - lastX, y3 - lastY);
    accum += seg;
    out.push(x3, y3);
    arcOut.push(accum);
    return accum;
  }
  const x01 = (x0 + x1) * 0.5, y01 = (y0 + y1) * 0.5;
  const x12 = (x1 + x2) * 0.5, y12 = (y1 + y2) * 0.5;
  const x23 = (x2 + x3) * 0.5, y23 = (y2 + y3) * 0.5;
  const x012 = (x01 + x12) * 0.5, y012 = (y01 + y12) * 0.5;
  const x123 = (x12 + x23) * 0.5, y123 = (y12 + y23) * 0.5;
  const x0123 = (x012 + x123) * 0.5, y0123 = (y012 + y123) * 0.5;
  accum = flattenCubicArcRec(x0, y0, x01, y01, x012, y012, x0123, y0123, tolerance, offset, out, arcOut, accum, depth + 1);
  accum = flattenCubicArcRec(x0123, y0123, x123, y123, x23, y23, x3, y3, tolerance, offset, out, arcOut, accum, depth + 1);
  return accum;
}

/** Flatten a quadratic bezier into line segments within `tolerance`, appending
 *  points to `out` and their cumulative arc lengths to `arcOut`. The arc
 *  lengths are what lets per-anchor color and dash phase be interpolated
 *  evenly along the curve rather than per segment. */
export function flattenQuadraticWithArcLen(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  tolerance: number,
  out: number[],
  arcOut: number[],
  offset = 0,
): number {
  if (!finite6(x0, y0, x1, y1, x2, y2)) {
    out.push(x2, y2);
    arcOut.push(0);
    return 0;
  }
  return flattenQuadraticArcRec(x0, y0, x1, y1, x2, y2, usableTolerance(tolerance), offset, out, arcOut, 0, 0);
}

function flattenQuadraticArcRec(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  tolerance: number,
  offset: number,
  out: number[],
  arcOut: number[],
  accum: number,
  depth: number,
): number {
  const d = pointSegmentDist(x1, y1, x0, y0, x2, y2);
  const flat = d <= tolerance
    && (offset === 0 || edgesWithin(x0, y0, x1, y1, x2, y2, x2, y2, offset, tolerance));
  if (flat || depth >= MAX_FLATTEN_DEPTH) {
    const lastX = out.length >= 2 ? out[out.length - 2] : x0;
    const lastY = out.length >= 2 ? out[out.length - 1] : y0;
    const seg = Math.hypot(x2 - lastX, y2 - lastY);
    accum += seg;
    out.push(x2, y2);
    arcOut.push(accum);
    return accum;
  }
  const x01 = (x0 + x1) * 0.5, y01 = (y0 + y1) * 0.5;
  const x12 = (x1 + x2) * 0.5, y12 = (y1 + y2) * 0.5;
  const x012 = (x01 + x12) * 0.5, y012 = (y01 + y12) * 0.5;
  accum = flattenQuadraticArcRec(x0, y0, x01, y01, x012, y012, tolerance, offset, out, arcOut, accum, depth + 1);
  accum = flattenQuadraticArcRec(x012, y012, x12, y12, x2, y2, tolerance, offset, out, arcOut, accum, depth + 1);
  return accum;
}

