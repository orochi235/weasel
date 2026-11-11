import type { Point } from './placement';

const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/** Whether `p` lies in triangle `abc`, edges included. A triangle flattened to a segment or a point holds only
 *  what lies on it. */
export function inTriangle(p: Point, a: Point, b: Point, c: Point): boolean {
  const d1 = cross(p, a, b), d2 = cross(p, b, c), d3 = cross(p, c, a);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  if (neg && pos) return false;
  if (neg || pos || cross(a, b, c) !== 0) return true;
  // `p` is on the line the three share: inside only between its outermost two.
  return p.x >= Math.min(a.x, b.x, c.x) && p.x <= Math.max(a.x, b.x, c.x)
    && p.y >= Math.min(a.y, b.y, c.y) && p.y <= Math.max(a.y, b.y, c.y);
}
