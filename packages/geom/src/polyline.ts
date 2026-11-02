import { sign } from './scalar';

/**
 * Even-odd ray-cast point-in-polygon over an interleaved, unclosed contour
 * [x0,y0,x1,y1,…]. The closing edge (last→first) is implicit.
 *
 * `start`/`end` are vertex indices, not float offsets, and bound one contour
 * inside a buffer holding several.
 */
export function pointInPolygon(
  coords: ArrayLike<number>,
  px: number,
  py: number,
  start = 0,
  end = coords.length >> 1,
): boolean {
  if (end - start < 3) return false;
  let inside = false;
  for (let i = start, j = end - 1; i < end; j = i++) {
    const xi = coords[i * 2], yi = coords[i * 2 + 1];
    const xj = coords[j * 2], yj = coords[j * 2 + 1];
    const crosses =
      (yi > py) !== (yj > py) &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

/**
 * Signed shoelace area of an interleaved, unclosed ring, its closing edge
 * implicit as in {@link pointInPolygon}: positive when the ring runs
 * counterclockwise with y up, so clockwise on a y-down screen. `start`/`end`
 * are vertex indices bounding one ring in a buffer holding several.
 */
export function ringSignedArea(
  coords: ArrayLike<number>,
  start = 0,
  end = coords.length >> 1,
): number {
  let a = 0;
  for (let i = start; i < end; i++) {
    const j = i + 1 === end ? start : i + 1;
    a += coords[i * 2] * coords[j * 2 + 1] - coords[j * 2] * coords[i * 2 + 1];
  }
  return a * 0.5;
}

/**
 * True if segments (ax,ay)-(bx,by) and (cx,cy)-(dx,dy) intersect at a single
 * point. An endpoint landing on the other segment counts (a T-junction and a
 * shared endpoint both answer true) — hit-testing wants a grazing edge to
 * register. Collinear overlap answers false: there is no single crossing
 * point, so the sign test both segments rely on is zero on all four sides.
 */
export function segmentsCross(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): boolean {
  const d1 = sign((dx - cx) * (ay - cy) - (dy - cy) * (ax - cx));
  const d2 = sign((dx - cx) * (by - cy) - (dy - cy) * (bx - cx));
  const d3 = sign((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));
  const d4 = sign((bx - ax) * (dy - ay) - (by - ay) * (dx - ax));
  return d1 !== d2 && d3 !== d4;
}
