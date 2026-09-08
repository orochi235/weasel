/**
 * Path-vs-geometry hit-test helpers. Five pure functions covering all
 * combinations of path-vs-point, path-vs-rect, and path-vs-polygon.
 *
 * `RectPath` short-circuits to AABB arithmetic. A `PolygonPath` is treated as
 * its filled region: whether a point is inside comes from `pointInPath`, so
 * beziers are flattened and `fillRule` is honored, and every closed subpath
 * counts — the hole of a donut is not part of the shape under `evenodd`. Open
 * subpaths enclose no area and are ignored, matching `pointInPath`.
 */

import { pointInPolygon, segmentsCross } from '@weasel-js/geom';
import { pointInPath, type PointInPathOptions } from './hitTest';
import { flattenCubic, flattenQuadratic, DEFAULT_FLATTEN_TOLERANCE } from './flatten';
import type { Vec2, Rect } from 'core/geometry/polygonHitTestRect';
import {
  PATH_M,
  PATH_L,
  PATH_C,
  PATH_Q,
  PATH_Z,
  type Path,
  type PolygonPath,
} from './types';

/**
 * Every closed subpath of `path`, flattened to interleaved `[x, y, …]`. The
 * closing edge back to the first vertex is implicit.
 */
function closedSubpaths(path: PolygonPath, tolerance: number): number[][] {
  const { commands, coords } = path;
  const out: number[][] = [];
  let sub: number[] = [];
  let subStartX = 0, subStartY = 0;
  let curX = 0, curY = 0;
  let ci = 0;

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    switch (cmd) {
      case PATH_M: {
        sub = [];
        subStartX = coords[ci]; subStartY = coords[ci + 1];
        curX = subStartX; curY = subStartY;
        sub.push(curX, curY);
        ci += 2;
        break;
      }
      case PATH_L: {
        curX = coords[ci]; curY = coords[ci + 1];
        sub.push(curX, curY);
        ci += 2;
        break;
      }
      case PATH_C: {
        const x1 = coords[ci],     y1 = coords[ci + 1];
        const x2 = coords[ci + 2], y2 = coords[ci + 3];
        const x3 = coords[ci + 4], y3 = coords[ci + 5];
        flattenCubic(curX, curY, x1, y1, x2, y2, x3, y3, tolerance, sub);
        curX = x3; curY = y3;
        ci += 6;
        break;
      }
      case PATH_Q: {
        const x1 = coords[ci],     y1 = coords[ci + 1];
        const x2 = coords[ci + 2], y2 = coords[ci + 3];
        flattenQuadratic(curX, curY, x1, y1, x2, y2, tolerance, sub);
        curX = x2; curY = y2;
        ci += 4;
        break;
      }
      case PATH_Z: {
        if (sub.length >= 6) out.push(sub);
        sub = [];
        curX = subStartX; curY = subStartY;
        break;
      }
      default:
        throw new Error(`pathHitTest: unknown command ${cmd}`);
    }
  }
  return out;
}

function rectToVerts(r: Rect): Vec2[] {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.width, y: r.y },
    { x: r.x + r.width, y: r.y + r.height },
    { x: r.x, y: r.y + r.height },
  ];
}

/** Flatten a Vec2 array into an interleaved [x0,y0,x1,y1,...] array. */
function flattenVerts(poly: readonly Vec2[]): number[] {
  const flat: number[] = new Array(poly.length * 2);
  for (let i = 0; i < poly.length; i++) {
    flat[i * 2] = poly[i].x;
    flat[i * 2 + 1] = poly[i].y;
  }
  return flat;
}

/** Edge-vs-edge segment intersection check between two closed polygons. */
function polygonsIntersect(a: readonly Vec2[], b: readonly Vec2[]): boolean {
  if (a.length === 0 || b.length === 0) return false; // nothing to intersect
  // Quick containment check — one polygon fully inside the other?
  if (pointInPolygon(flattenVerts(a), b[0].x, b[0].y)) return true;
  if (pointInPolygon(flattenVerts(b), a[0].x, a[0].y)) return true;
  // Edge-vs-edge crossings.
  for (let i = 0; i < a.length; i++) {
    const a0 = a[i], a1 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      const b0 = b[j], b1 = b[(j + 1) % b.length];
      if (segmentsCross(a0.x, a0.y, a1.x, a1.y, b0.x, b0.y, b1.x, b1.y)) return true;
    }
  }
  return false;
}

/** Run `visit` over every edge of every closed subpath until it answers true. */
function anyEdge(
  subpaths: readonly number[][],
  visit: (ax: number, ay: number, bx: number, by: number) => boolean,
): boolean {
  for (const sub of subpaths) {
    const n = sub.length;
    for (let i = 0; i < n; i += 2) {
      const j = (i + 2) % n;
      if (visit(sub[i], sub[i + 1], sub[j], sub[j + 1])) return true;
    }
  }
  return false;
}

function anyEdgeCrossesRect(subpaths: readonly number[][], r: Rect): boolean {
  const x0 = r.x, y0 = r.y, x1 = r.x + r.width, y1 = r.y + r.height;
  return anyEdge(subpaths, (ax, ay, bx, by) =>
    segmentsCross(ax, ay, bx, by, x0, y0, x1, y0) ||
    segmentsCross(ax, ay, bx, by, x1, y0, x1, y1) ||
    segmentsCross(ax, ay, bx, by, x1, y1, x0, y1) ||
    segmentsCross(ax, ay, bx, by, x0, y1, x0, y0),
  );
}

function anyEdgeCrossesPolygon(subpaths: readonly number[][], poly: readonly Vec2[]): boolean {
  if (poly.length === 0) return false;
  return anyEdge(subpaths, (ax, ay, bx, by) => {
    for (let i = 0; i < poly.length; i++) {
      const p0 = poly[i], p1 = poly[(i + 1) % poly.length];
      if (segmentsCross(ax, ay, bx, by, p0.x, p0.y, p1.x, p1.y)) return true;
    }
    return false;
  });
}

function anyVertexInRect(subpaths: readonly number[][], r: Rect): boolean {
  for (const sub of subpaths) {
    for (let i = 0; i < sub.length; i += 2) {
      const x = sub[i], y = sub[i + 1];
      if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) return true;
    }
  }
  return false;
}

function anyVertexInPolygon(subpaths: readonly number[][], flatPoly: readonly number[]): boolean {
  for (const sub of subpaths) {
    for (let i = 0; i < sub.length; i += 2) {
      if (pointInPolygon(flatPoly, sub[i], sub[i + 1])) return true;
    }
  }
  return false;
}

function subpathsOf(path: PolygonPath, opts: PointInPathOptions): number[][] {
  return closedSubpaths(path, opts.tolerance ?? DEFAULT_FLATTEN_TOLERANCE);
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Returns true if (x, y) lies within the filled region of `path`. */
export function pathContainsPoint(
  path: Path,
  x: number,
  y: number,
  opts: PointInPathOptions = {},
): boolean {
  return pointInPath(path, x, y, opts);
}

/** Returns true if `rect` is entirely contained within `path`. */
export function pathContainsRect(path: Path, rect: Rect, opts: PointInPathOptions = {}): boolean {
  if (path.kind === 'rect') {
    return (
      rect.x >= path.x &&
      rect.y >= path.y &&
      rect.x + rect.width <= path.x + path.width &&
      rect.y + rect.height <= path.y + path.height
    );
  }
  const subpaths = subpathsOf(path, opts);
  if (subpaths.length === 0) return false;
  for (const c of rectToVerts(rect)) {
    if (!pointInPath(path, c.x, c.y, opts)) return false;
  }
  // Every corner is filled, but any contour reaching into the rect — the
  // boundary of a hole, or a concave notch — leaves part of it unfilled.
  return !anyVertexInRect(subpaths, rect) && !anyEdgeCrossesRect(subpaths, rect);
}

/** Returns true if `rect` overlaps (intersects or contains) `path`. */
export function pathIntersectsRect(path: Path, rect: Rect, opts: PointInPathOptions = {}): boolean {
  if (path.kind === 'rect') {
    return (
      rect.x < path.x + path.width &&
      rect.x + rect.width > path.x &&
      rect.y < path.y + path.height &&
      rect.y + rect.height > path.y
    );
  }
  const subpaths = subpathsOf(path, opts);
  if (subpaths.length === 0) return false;
  for (const c of rectToVerts(rect)) {
    if (pointInPath(path, c.x, c.y, opts)) return true;
  }
  if (anyVertexInRect(subpaths, rect)) return true;
  return anyEdgeCrossesRect(subpaths, rect);
}

/** Returns true if every vertex of `polygon` lies inside `path`. */
export function pathContainsPolygon(
  path: Path,
  polygon: readonly Vec2[],
  opts: PointInPathOptions = {},
): boolean {
  if (polygon.length === 0) return false; // empty polygon can't be "contained"
  if (path.kind === 'rect') {
    return polygon.every(
      (p) =>
        p.x >= path.x &&
        p.x <= path.x + path.width &&
        p.y >= path.y &&
        p.y <= path.y + path.height,
    );
  }
  const subpaths = subpathsOf(path, opts);
  if (subpaths.length === 0) return false;
  for (const p of polygon) {
    if (!pointInPath(path, p.x, p.y, opts)) return false;
  }
  return !anyVertexInPolygon(subpaths, flattenVerts(polygon)) &&
    !anyEdgeCrossesPolygon(subpaths, polygon);
}

/** Returns true if `polygon` overlaps (intersects or is contained by) `path`. */
export function pathIntersectsPolygon(
  path: Path,
  polygon: readonly Vec2[],
  opts: PointInPathOptions = {},
): boolean {
  if (polygon.length === 0) return false;
  if (path.kind === 'rect') {
    return polygonsIntersect(rectToVerts(path), polygon);
  }
  const subpaths = subpathsOf(path, opts);
  if (subpaths.length === 0) return false;
  for (const p of polygon) {
    if (pointInPath(path, p.x, p.y, opts)) return true;
  }
  if (anyVertexInPolygon(subpaths, flattenVerts(polygon))) return true;
  return anyEdgeCrossesPolygon(subpaths, polygon);
}
