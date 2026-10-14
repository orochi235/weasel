import { cubicEvalAt, splitCubicAt, type CubicCoords } from '../curve';

/** A 2D point, the shape the point-taking path helpers read and return. */
export interface Point { x: number; y: number; }

/** Point on the cubic Bezier (p0, p1, p2, p3) at parameter t. The point-shaped
 *  face of geom's `cubicEvalAt`. */
export function cubicPointAt(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const [x, y] = cubicEvalAt(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, t);
  return { x, y };
}

/** De Casteljau subdivision of a cubic at parameter t. The point-shaped face
 *  of geom's `splitCubicAt`; `left[3]` and `right[0]` are the point at t. */
export function splitCubicAtT(
  p0: Point, p1: Point, p2: Point, p3: Point,
  t: number,
): { left: [Point, Point, Point, Point]; right: [Point, Point, Point, Point] } {
  const [l, r] = splitCubicAt(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, t);
  const quad = (c: CubicCoords): [Point, Point, Point, Point] =>
    [{ x: c[0], y: c[1] }, { x: c[2], y: c[3] }, { x: c[4], y: c[5] }, { x: c[6], y: c[7] }];
  return { left: quad(l), right: quad(r) };
}
