import type { Box } from './box';

/** Cubic Bezier point at parameter t (de Casteljau / Bernstein form). */
export function cubicEvalAt(
  x0: number, y0: number, x1: number, y1: number,
  x2: number, y2: number, x3: number, y3: number, t: number,
): [number, number] {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [
    a * x0 + b * x1 + c * x2 + d * x3,
    a * y0 + b * y1 + c * y2 + d * y3,
  ];
}

/**
 * Degree-elevate a quadratic (q0, ctrl, q1) to a cubic. Returns the two
 * cubic control points [c1x, c1y, c2x, c2y]; the cubic endpoints equal the
 * quadratic endpoints. c1 = q0 + 2/3(ctrl-q0), c2 = q1 + 2/3(ctrl-q1).
 */
export function elevateQuadraticToCubic(
  q0x: number, q0y: number, cx: number, cy: number, q1x: number, q1y: number,
): [number, number, number, number] {
  return [
    q0x + (2 / 3) * (cx - q0x),
    q0y + (2 / 3) * (cy - q0y),
    q1x + (2 / 3) * (cx - q1x),
    q1y + (2 / 3) * (cy - q1y),
  ];
}

/** Distance from point P to line AB (perpendicular). Ported verbatim from
 *  features/paths/flatten.ts (helper for flattenCubic's flatness predicate). */
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
 * Adaptive flatten of a cubic into interleaved points appended to `out`
 * (excludes the start point, includes the endpoint). Ported verbatim from
 * features/paths/flatten.ts:37.
 */
export function flattenCubic(
  x0: number, y0: number, x1: number, y1: number,
  x2: number, y2: number, x3: number, y3: number,
  tolerance: number, out: number[],
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

/** Axis-aligned extrema parameters of one cubic component (the 0,1 ends plus
 *  any derivative roots in (0,1)). Used by cubicBounds. */
function componentExtremaTs(p0: number, p1: number, p2: number, p3: number): number[] {
  // B'(t)=0 → quadratic a t² + b t + c = 0 with:
  const a = -p0 + 3 * p1 - 3 * p2 + p3;
  const b = 2 * (p0 - 2 * p1 + p2);
  const c = -p0 + p1;
  const ts: number[] = [];
  const push = (t: number) => { if (t > 0 && t < 1) ts.push(t); };
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) > 1e-12) push(-c / b);
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      push((-b + sq) / (2 * a));
      push((-b - sq) / (2 * a));
    }
  }
  return ts;
}

/** Tight AABB of a cubic, evaluating only extrema that lie on the curve. */
export function cubicBounds(
  x0: number, y0: number, x1: number, y1: number,
  x2: number, y2: number, x3: number, y3: number,
): Box {
  let minX = Math.min(x0, x3), maxX = Math.max(x0, x3);
  let minY = Math.min(y0, y3), maxY = Math.max(y0, y3);
  for (const t of componentExtremaTs(x0, x1, x2, x3)) {
    const [ex] = cubicEvalAt(x0, y0, x1, y1, x2, y2, x3, y3, t);
    if (ex < minX) minX = ex;
    if (ex > maxX) maxX = ex;
  }
  for (const t of componentExtremaTs(y0, y1, y2, y3)) {
    const [, ey] = cubicEvalAt(x0, y0, x1, y1, x2, y2, x3, y3, t);
    if (ey < minY) minY = ey;
    if (ey > maxY) maxY = ey;
  }
  return [minX, minY, maxX, maxY];
}
