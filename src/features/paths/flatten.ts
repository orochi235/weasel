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
  flattenCubic(x0, y0, x01, y01, x012, y012, x0123, y0123, tolerance, out);
  flattenCubic(x0123, y0123, x123, y123, x23, y23, x3, y3, tolerance, out);
}

/** Recursively subdivide a quadratic bezier (P0, P1, P2). */
export function flattenQuadratic(
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
  flattenQuadratic(x0, y0, x01, y01, x012, y012, tolerance, out);
  flattenQuadratic(x012, y012, x12, y12, x2, y2, tolerance, out);
}
