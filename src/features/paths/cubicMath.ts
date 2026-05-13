export interface Point { x: number; y: number; }

/**
 * De Casteljau subdivision of a cubic Bezier at parameter t ∈ [0, 1].
 * Returns the two halves as cubic control-point tuples. The point at parameter
 * t on the original curve is shared between `left[3]` and `right[0]`.
 */
export function splitCubicAtT(
  p0: Point, p1: Point, p2: Point, p3: Point,
  t: number,
): { left: [Point, Point, Point, Point]; right: [Point, Point, Point, Point] } {
  const lerp = (a: Point, b: Point): Point => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  });
  const q0 = lerp(p0, p1);
  const q1 = lerp(p1, p2);
  const q2 = lerp(p2, p3);
  const r0 = lerp(q0, q1);
  const r1 = lerp(q1, q2);
  const s0 = lerp(r0, r1);
  return {
    left: [p0, q0, r0, s0],
    right: [s0, r1, q2, p3],
  };
}
