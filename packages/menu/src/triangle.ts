import type { Point } from './placement';

const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/** Whether `p` lies in triangle `abc`, edges included. */
export function inTriangle(p: Point, a: Point, b: Point, c: Point): boolean {
  const d1 = cross(p, a, b), d2 = cross(p, b, c), d3 = cross(p, c, a);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}
