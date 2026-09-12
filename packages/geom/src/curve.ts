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
