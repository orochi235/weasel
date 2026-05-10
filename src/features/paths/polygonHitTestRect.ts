/**
 * Polygon-vs-axis-aligned-rect tests. Pure functions; no React/kit deps.
 *
 * `polygon` is a closed polyline given as an ordered vertex array; the
 * closing edge from `polygon[N-1]` to `polygon[0]` is implicit. Even-odd
 * fill rule (matches `pointInPath`).
 */

export interface Vec2 { x: number; y: number }
export interface Rect { x: number; y: number; width: number; height: number }

/** Even-odd ray-cast point-in-polygon. Closing edge implicit. */
function pointInPolygon(poly: ReadonlyArray<Vec2>, px: number, py: number): boolean {
  if (poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const crosses =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function polygonContainsRectCenter(poly: ReadonlyArray<Vec2>, rect: Rect): boolean {
  return pointInPolygon(poly, rect.x + rect.width / 2, rect.y + rect.height / 2);
}

export function polygonContainsRect(poly: ReadonlyArray<Vec2>, rect: Rect): boolean {
  if (poly.length < 3) return false;
  const corners: Vec2[] = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];
  for (const c of corners) {
    if (!pointInPolygon(poly, c.x, c.y)) return false;
  }
  // All corners are inside, but a non-convex polygon could still cut the rect.
  // If any polygon edge intersects any rect edge, rect is not fully contained.
  return !anyPolyEdgeCrossesRect(poly, rect);
}

export function polygonIntersectsRect(poly: ReadonlyArray<Vec2>, rect: Rect): boolean {
  if (poly.length < 3) return false;
  // Quick AABB reject.
  const ab = polygonAabb(poly);
  if (ab.x + ab.width < rect.x || ab.x > rect.x + rect.width) return false;
  if (ab.y + ab.height < rect.y || ab.y > rect.y + rect.height) return false;
  // Any polygon vertex inside rect?
  for (const v of poly) {
    if (v.x >= rect.x && v.x <= rect.x + rect.width &&
        v.y >= rect.y && v.y <= rect.y + rect.height) return true;
  }
  // Any rect corner inside polygon?
  if (pointInPolygon(poly, rect.x, rect.y)) return true;
  if (pointInPolygon(poly, rect.x + rect.width, rect.y)) return true;
  if (pointInPolygon(poly, rect.x + rect.width, rect.y + rect.height)) return true;
  if (pointInPolygon(poly, rect.x, rect.y + rect.height)) return true;
  // Edge-vs-edge crossings.
  return anyPolyEdgeCrossesRect(poly, rect);
}

function polygonAabb(poly: ReadonlyArray<Vec2>): Rect {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of poly) {
    if (v.x < minX) minX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.x > maxX) maxX = v.x;
    if (v.y > maxY) maxY = v.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function anyPolyEdgeCrossesRect(poly: ReadonlyArray<Vec2>, rect: Rect): boolean {
  const r0 = { x: rect.x, y: rect.y };
  const r1 = { x: rect.x + rect.width, y: rect.y };
  const r2 = { x: rect.x + rect.width, y: rect.y + rect.height };
  const r3 = { x: rect.x, y: rect.y + rect.height };
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j], b = poly[i];
    if (segmentsCross(a, b, r0, r1)) return true;
    if (segmentsCross(a, b, r1, r2)) return true;
    if (segmentsCross(a, b, r2, r3)) return true;
    if (segmentsCross(a, b, r3, r0)) return true;
  }
  return false;
}

function segmentsCross(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const d1 = sign((d.x - c.x) * (a.y - c.y) - (d.y - c.y) * (a.x - c.x));
  const d2 = sign((d.x - c.x) * (b.y - c.y) - (d.y - c.y) * (b.x - c.x));
  const d3 = sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
  const d4 = sign((b.x - a.x) * (d.y - a.y) - (b.y - a.y) * (d.x - a.x));
  return d1 !== d2 && d3 !== d4;
}

function sign(n: number): -1 | 0 | 1 {
  return n > 0 ? 1 : n < 0 ? -1 : 0;
}
