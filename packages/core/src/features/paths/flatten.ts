/**
 * Bezier flattening — subdivide cubic and quadratic segments into polyline
 * approximations within a flatness tolerance. Used by hit-testing and
 * (eventually) any kernel that doesn't want to special-case curves.
 *
 * The flatness metric is the maximum perpendicular distance from any
 * control point to the chord between endpoints. When that distance falls
 * below `tolerance`, the segment is "flat enough" and emitted as a single
 * line segment.
 *
 * Tolerance is in world units. 0.5 is a sensible default for screen-rate
 * rendering at 1× zoom; consumers that zoom in heavily should pass a
 * tighter tolerance.
 */

export const DEFAULT_FLATTEN_TOLERANCE = 0.5;

/** Floor for a non-positive or NaN tolerance. Without it the flatness test can
 *  never be satisfied and the subdivision recurses until the stack blows. */
const MIN_FLATTEN_TOLERANCE = 1e-6;

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

/** Distance from point P to line AB (perpendicular). */
function distPointToLine(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) {
    const ex = px - ax;
    const ey = py - ay;
    return Math.sqrt(ex * ex + ey * ey);
  }
  const cross = (px - ax) * dy - (py - ay) * dx;
  return Math.abs(cross) / Math.sqrt(len2);
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
  flattenCubicRec(x0, y0, x1, y1, x2, y2, x3, y3, usableTolerance(tolerance), out);
}

function flattenCubicRec(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
  tolerance: number,
  out: number[],
): void {
  const d1 = distPointToLine(x1, y1, x0, y0, x3, y3);
  const d2 = distPointToLine(x2, y2, x0, y0, x3, y3);
  if (Math.max(d1, d2) <= tolerance) {
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
  flattenCubicRec(x0, y0, x01, y01, x012, y012, x0123, y0123, tolerance, out);
  flattenCubicRec(x0123, y0123, x123, y123, x23, y23, x3, y3, tolerance, out);
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
  flattenQuadraticRec(x0, y0, x1, y1, x2, y2, usableTolerance(tolerance), out);
}

function flattenQuadraticRec(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  tolerance: number,
  out: number[],
): void {
  const d = distPointToLine(x1, y1, x0, y0, x2, y2);
  if (d <= tolerance) {
    out.push(x2, y2);
    return;
  }
  const x01 = (x0 + x1) * 0.5, y01 = (y0 + y1) * 0.5;
  const x12 = (x1 + x2) * 0.5, y12 = (y1 + y2) * 0.5;
  const x012 = (x01 + x12) * 0.5, y012 = (y01 + y12) * 0.5;
  flattenQuadraticRec(x0, y0, x01, y01, x012, y012, tolerance, out);
  flattenQuadraticRec(x012, y012, x12, y12, x2, y2, tolerance, out);
}

/**
 * Like `flattenCubic` but also appends, for each new flattened point, its
 * arc-length fraction `t` (relative to the polyline distance accumulated so
 * far inside this curve) to `arcOut`. Caller then post-processes the segment's
 * `arcOut` range by dividing each by the segment's total flattened arc length
 * to yield t ∈ (0, 1].
 *
 * The returned values are *cumulative distance from the segment start*, not
 * normalized fractions. Two-pass design (accumulate, then divide) keeps the
 * recursive splitter simple — it doesn't need to know the total length up
 * front.
 */
export function flattenCubicWithArcLen(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
  tolerance: number,
  out: number[],
  arcOut: number[],
): number {
  if (!finite8(x0, y0, x1, y1, x2, y2, x3, y3)) {
    out.push(x3, y3);
    arcOut.push(0);
    return 0;
  }
  return flattenCubicArcRec(x0, y0, x1, y1, x2, y2, x3, y3, usableTolerance(tolerance), out, arcOut, 0);
}

function flattenCubicArcRec(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
  tolerance: number,
  out: number[],
  arcOut: number[],
  accum: number,
): number {
  const d1 = distPointToLine(x1, y1, x0, y0, x3, y3);
  const d2 = distPointToLine(x2, y2, x0, y0, x3, y3);
  if (Math.max(d1, d2) <= tolerance) {
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
  accum = flattenCubicArcRec(x0, y0, x01, y01, x012, y012, x0123, y0123, tolerance, out, arcOut, accum);
  accum = flattenCubicArcRec(x0123, y0123, x123, y123, x23, y23, x3, y3, tolerance, out, arcOut, accum);
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
): number {
  if (!finite6(x0, y0, x1, y1, x2, y2)) {
    out.push(x2, y2);
    arcOut.push(0);
    return 0;
  }
  return flattenQuadraticArcRec(x0, y0, x1, y1, x2, y2, usableTolerance(tolerance), out, arcOut, 0);
}

function flattenQuadraticArcRec(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  tolerance: number,
  out: number[],
  arcOut: number[],
  accum: number,
): number {
  const d = distPointToLine(x1, y1, x0, y0, x2, y2);
  if (d <= tolerance) {
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
  accum = flattenQuadraticArcRec(x0, y0, x01, y01, x012, y012, tolerance, out, arcOut, accum);
  accum = flattenQuadraticArcRec(x012, y012, x12, y12, x2, y2, tolerance, out, arcOut, accum);
  return accum;
}

