/**
 * Polygon-vs-axis-aligned-rect tests. Pure functions; no React/kit deps.
 *
 * `polygon` is a closed polyline given as an ordered vertex array; the
 * closing edge from `polygon[N-1]` to `polygon[0]` is implicit. Even-odd
 * fill rule (matches `pointInPath`).
 */

import { pointInPolygon, segmentsCross } from '@weasel-js/geom';

/** A 2D point or vector. */
export interface Vec2 { x: number; y: number }
/** An axis-aligned rectangle. */
export interface Rect { x: number; y: number; width: number; height: number }

/** Flatten a Vec2 array into an interleaved [x0,y0,x1,y1,...] array. */
function flattenVerts(poly: ReadonlyArray<Vec2>): number[] {
  const flat: number[] = new Array(poly.length * 2);
  for (let i = 0; i < poly.length; i++) {
    flat[i * 2] = poly[i].x;
    flat[i * 2 + 1] = poly[i].y;
  }
  return flat;
}

export function polygonContainsRectCenter(poly: ReadonlyArray<Vec2>, rect: Rect): boolean {
  return pointInPolygon(flattenVerts(poly), rect.x + rect.width / 2, rect.y + rect.height / 2);
}

export function polygonContainsRect(poly: ReadonlyArray<Vec2>, rect: Rect): boolean {
  if (poly.length < 3) return false;
  const flat = flattenVerts(poly);
  if (!pointInPolygon(flat, rect.x, rect.y)) return false;
  if (!pointInPolygon(flat, rect.x + rect.width, rect.y)) return false;
  if (!pointInPolygon(flat, rect.x + rect.width, rect.y + rect.height)) return false;
  if (!pointInPolygon(flat, rect.x, rect.y + rect.height)) return false;
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
  const flat = flattenVerts(poly);
  if (pointInPolygon(flat, rect.x, rect.y)) return true;
  if (pointInPolygon(flat, rect.x + rect.width, rect.y)) return true;
  if (pointInPolygon(flat, rect.x + rect.width, rect.y + rect.height)) return true;
  if (pointInPolygon(flat, rect.x, rect.y + rect.height)) return true;
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
  const r0x = rect.x,            r0y = rect.y;
  const r1x = rect.x + rect.width, r1y = rect.y;
  const r2x = rect.x + rect.width, r2y = rect.y + rect.height;
  const r3x = rect.x,            r3y = rect.y + rect.height;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j], b = poly[i];
    if (segmentsCross(a.x, a.y, b.x, b.y, r0x, r0y, r1x, r1y)) return true;
    if (segmentsCross(a.x, a.y, b.x, b.y, r1x, r1y, r2x, r2y)) return true;
    if (segmentsCross(a.x, a.y, b.x, b.y, r2x, r2y, r3x, r3y)) return true;
    if (segmentsCross(a.x, a.y, b.x, b.y, r3x, r3y, r0x, r0y)) return true;
  }
  return false;
}
