/**
 * Maps from the unit square onto a quadrilateral: what a box becomes when its
 * four corners are dragged apart independently.
 */
import type { Point } from '../paths/cubicMath';

/** Four corners, in the order the unit square's land on them: (0,0), (1,0),
 *  (1,1), (0,1) — a box's top-left, top-right, bottom-right, bottom-left. */
export type Quad = readonly [Point, Point, Point, Point];

/** A map from unit-square coordinates to the plane. */
export type UvMap = (u: number, v: number) => Point;

/**
 * The bilinear map onto `q`: each corner weighted by its share of the square.
 * Lines of constant `u` or `v` stay straight; any other line bends.
 */
export function bilinearQuad(q: Quad): UvMap {
  const [a, b, c, d] = q;
  return (u, v) => {
    const w00 = (1 - u) * (1 - v);
    const w10 = u * (1 - v);
    const w11 = u * v;
    const w01 = (1 - u) * v;
    return {
      x: w00 * a.x + w10 * b.x + w11 * c.x + w01 * d.x,
      y: w00 * a.y + w10 * b.y + w11 * c.y + w01 * d.y,
    };
  };
}

/**
 * The projective map taking the unit square onto `q`, as `[a, b, c, d, e, f,
 * g, h]`: `x = (a·u + b·v + c) / w` and `y = (d·u + e·v + f) / w`, where
 * `w = g·u + h·v + 1`. Null when `q` is not strictly convex, since no
 * projective map then sends the square's inside onto the quad's.
 */
export function squareToQuadHomography(q: Quad): readonly number[] | null {
  if (!isConvex(q)) return null;
  const [p0, p1, p2, p3] = q;
  const sx = p0.x - p1.x + p2.x - p3.x;
  const sy = p0.y - p1.y + p2.y - p3.y;
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const den = dx1 * dy2 - dx2 * dy1;
  if (den === 0) return null;
  const g = (sx * dy2 - dx2 * sy) / den;
  const h = (dx1 * sy - sx * dy1) / den;
  return [
    p1.x - p0.x + g * p1.x, p3.x - p0.x + h * p3.x, p0.x,
    p1.y - p0.y + g * p1.y, p3.y - p0.y + h * p3.y, p0.y,
    g, h,
  ];
}

/**
 * The projective map onto `q`: straight lines stay straight, and the box's far
 * side foreshortens the way a plane seen at an angle does. Null where
 * {@link squareToQuadHomography} is.
 */
export function projectiveQuad(q: Quad): UvMap | null {
  const m = squareToQuadHomography(q);
  if (!m) return null;
  const [a, b, c, d, e, f, g, h] = m;
  return (u, v) => {
    const w = g * u + h * v + 1;
    return { x: (a * u + b * v + c) / w, y: (d * u + e * v + f) / w };
  };
}

/** Whether every turn around `q` goes the same way, none of them straight. */
function isConvex(q: Quad): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    const c = q[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (cross === 0) return false;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  return true;
}
