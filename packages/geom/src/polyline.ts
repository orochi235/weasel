import { sign, dot, len2 } from './scalar';

/**
 * Even-odd ray-cast point-in-polygon over an interleaved, unclosed contour
 * [x0,y0,x1,y1,…]. The closing edge (last→first) is implicit. Flat rewrite of
 * features/paths/polygonHitTestRect.ts pointInPolygon — same algorithm.
 */
export function pointInPolygon(coords: ArrayLike<number>, px: number, py: number): boolean {
  const n = coords.length >> 1;
  if (n < 3) return false;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = coords[i * 2], yi = coords[i * 2 + 1];
    const xj = coords[j * 2], yj = coords[j * 2 + 1];
    const crosses =
      (yi > py) !== (yj > py) &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

/** True if segment (ax,ay)-(bx,by) properly crosses (cx,cy)-(dx,dy). Flat
 *  rewrite of polygonHitTestRect.ts segmentsCross. */
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

/** Squared distance from (px,py) to segment (ax,ay)-(bx,by), endpoint-clamped. */
export function pointSegmentDist2(
  px: number, py: number, ax: number, ay: number, bx: number, by: number,
): number {
  const vx = bx - ax, vy = by - ay;
  const wx = px - ax, wy = py - ay;
  const vv = len2(vx, vy);
  let t = vv === 0 ? 0 : dot(wx, wy, vx, vy) / vv;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = px - (ax + t * vx), dy = py - (ay + t * vy);
  return len2(dx, dy);
}
