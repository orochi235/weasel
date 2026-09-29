/**
 * Path hit-testing: path-vs-point (filled region and stroke distance),
 * path-vs-rect, and path-vs-polygon in both directions.
 *
 * A `rect` path short-circuits to AABB arithmetic. A `polygon` path is its
 * filled region: beziers are flattened, `fillRule` is honored (default
 * `nonzero`), and every closed subpath counts — the hole of a donut is not
 * part of the shape under `evenodd`. Open subpaths enclose no area, so the
 * filled-region tests ignore them.
 */

import { forEachSegment, PATH_C, PATH_L, PATH_M, PATH_Q, PATH_Z } from './commands';
import { DEFAULT_FLATTEN_TOLERANCE, flattenCubic, flattenQuadratic } from './flatten';
import { pointInPolygon, pointSegmentDist2, segmentsCross } from './polyline';
import type { Rect } from './box';
import type { GeomPath } from './path';
import type { Mat3 } from './mat3';
import { capsuleWithinPx, isSimilarity, stretchOf, type Linear2 } from './screenBand';

type PolygonGeomPath = Extract<GeomPath, { kind: 'polygon' }>;
type XY = { x: number; y: number };

/** Options for the path hit-tests. */
export interface PointInPathOptions {
  /** Bezier flattening tolerance in world units. Default 0.5. */
  tolerance?: number;
}

/** Options for {@link strokeHitTest}. */
export interface StrokeHitTestOptions {
  /** Bezier flattening tolerance in world units. Default 0.5. */
  tolerance?: number;
  /** Extra reach past the band measured in screen pixels rather than world
   *  units: `px` pixels, after `transform` carries the path's frame to the
   *  screen (only its linear part matters). A pointer's forgiveness is a
   *  screen distance, and under a non-uniform or rotated-then-squished
   *  transform no world distance equals it. */
  slop?: { px: number; transform: Mat3 };
}

// ─── Flattening ─────────────────────────────────────────────────────────────

/**
 * `path` flattened to interleaved `[x, y, …]` runs, sorted by whether each
 * subpath encloses area. A `Z` closing fewer than three points yields an open
 * run, as does any subpath a `Z` never ends. The closing edge of a closed run
 * back to its first vertex is implicit.
 */
function flatSubpaths(
  path: PolygonGeomPath,
  tolerance: number,
): { closed: number[][]; open: number[][] } {
  const { commands, coords } = path;
  const closed: number[][] = [];
  const open: number[][] = [];
  let sub: number[] = [];

  forEachSegment(commands, coords, (cmd, ci, curX, curY) => {
    switch (cmd) {
      case PATH_M:
        if (sub.length >= 2) open.push(sub);
        sub = [coords[ci], coords[ci + 1]];
        break;
      case PATH_L:
        sub.push(coords[ci], coords[ci + 1]);
        break;
      case PATH_C:
        flattenCubic(
          curX, curY,
          coords[ci], coords[ci + 1],
          coords[ci + 2], coords[ci + 3],
          coords[ci + 4], coords[ci + 5],
          tolerance, sub,
        );
        break;
      case PATH_Q:
        flattenQuadratic(
          curX, curY,
          coords[ci], coords[ci + 1],
          coords[ci + 2], coords[ci + 3],
          tolerance, sub,
        );
        break;
      case PATH_Z:
        if (sub.length >= 6) closed.push(sub);
        else if (sub.length >= 2) open.push(sub);
        sub = [];
        break;
      default:
        throw new Error(`pathHitTest: unknown command ${cmd}`);
    }
  });
  if (sub.length >= 2) open.push(sub);
  return { closed, open };
}

function closedSubpaths(path: PolygonGeomPath, opts: PointInPathOptions): number[][] {
  return flatSubpaths(path, opts.tolerance ?? DEFAULT_FLATTEN_TOLERANCE).closed;
}

// ─── Point vs path ──────────────────────────────────────────────────────────

/** Filled-region hit-test for a path. Rect short-circuits to AABB; polygons run ray-cast / winding per `fillRule`. */
export function pointInPath(
  path: GeomPath,
  x: number,
  y: number,
  opts: PointInPathOptions = {},
): boolean {
  if (path.kind === 'rect') {
    return x >= path.x && x <= path.x + path.width && y >= path.y && y <= path.y + path.height;
  }
  let crossings = 0;
  let winding = 0;
  for (const sub of closedSubpaths(path, opts)) {
    const n = sub.length;
    for (let i = 0; i < n; i += 2) {
      const j = (i + 2) % n;
      const ay = sub[i + 1], by = sub[j + 1];
      if ((ay > y) === (by > y)) continue;
      const ax = sub[i], bx = sub[j];
      if (x >= ax + ((y - ay) / (by - ay)) * (bx - ax)) continue;
      crossings++;
      winding += ay <= y ? 1 : -1;
    }
  }
  return path.fillRule === 'evenodd' ? (crossings & 1) === 1 : winding !== 0;
}

/**
 * Stroke-distance hit-test. True when (x, y) lies within `threshold` world
 * units of the path's outline — when a stroke of total width `2 * threshold`
 * drawn along the path would cover the point. Works for open and closed
 * subpaths alike; OR it with {@link pointInPath} for fill-plus-stroke picking.
 * Every flattened segment is treated as a capsule of radius `threshold`.
 */
export function strokeHitTest(
  path: GeomPath,
  x: number,
  y: number,
  threshold: number,
  opts: StrokeHitTestOptions = {},
): boolean {
  const slop = opts.slop;
  if (slop && slop.px > 0) {
    const [a, b, c, d] = slop.transform;
    const m: Linear2 = { a, b, c, d };
    const st = stretchOf(m);
    if (isSimilarity(st)) {
      return strokeHitTest(path, x, y, threshold + slop.px / st.s1, { tolerance: opts.tolerance });
    }
    const sx = a * x + c * y, sy = b * x + d * y;
    return someSegment(path, opts.tolerance, (ax, ay, bx, by) =>
      capsuleWithinPx(sx, sy, ax, ay, bx, by, threshold, slop.px, m, st));
  }
  const t2 = threshold * threshold;
  return someSegment(path, opts.tolerance, (ax, ay, bx, by) =>
    pointSegmentDist2(x, y, ax, ay, bx, by) <= t2);
}

/** Does `visit` answer true for any outline segment — every edge of a rect,
 *  closing edges of closed subpaths included? */
function someSegment(
  path: GeomPath,
  tolerance: number | undefined,
  visit: (ax: number, ay: number, bx: number, by: number) => boolean,
): boolean {
  if (path.kind === 'rect') {
    const { x: rx, y: ry, width: w, height: h } = path;
    return visit(rx, ry, rx + w, ry) || visit(rx + w, ry, rx + w, ry + h)
      || visit(rx + w, ry + h, rx, ry + h) || visit(rx, ry + h, rx, ry);
  }
  const { closed, open } = flatSubpaths(path, tolerance ?? DEFAULT_FLATTEN_TOLERANCE);
  const run = (sub: readonly number[], wrap: boolean): boolean => {
    const n = sub.length;
    const last = wrap ? n : n - 2;
    for (let i = 0; i < last; i += 2) {
      const j = (i + 2) % n;
      if (visit(sub[i], sub[i + 1], sub[j], sub[j + 1])) return true;
    }
    return false;
  };
  return closed.some((sub) => run(sub, true)) || open.some((sub) => run(sub, false));
}

// ─── Region vs path ─────────────────────────────────────────────────────────

function rectToVerts(r: Rect): XY[] {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.width, y: r.y },
    { x: r.x + r.width, y: r.y + r.height },
    { x: r.x, y: r.y + r.height },
  ];
}

/** Flatten a vertex array into an interleaved [x0,y0,x1,y1,...] array. */
function flattenVerts(poly: readonly XY[]): number[] {
  const flat: number[] = new Array(poly.length * 2);
  for (let i = 0; i < poly.length; i++) {
    flat[i * 2] = poly[i].x;
    flat[i * 2 + 1] = poly[i].y;
  }
  return flat;
}

/** Edge-vs-edge segment intersection check between two closed polygons. */
function polygonsIntersect(a: readonly XY[], b: readonly XY[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  if (pointInPolygon(flattenVerts(a), b[0].x, b[0].y)) return true;
  if (pointInPolygon(flattenVerts(b), a[0].x, a[0].y)) return true;
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

function anyEdgeCrossesPolygon(subpaths: readonly number[][], poly: readonly XY[]): boolean {
  if (poly.length === 0) return false;
  return anyEdge(subpaths, (ax, ay, bx, by) => {
    for (let i = 0; i < poly.length; i++) {
      const p0 = poly[i], p1 = poly[(i + 1) % poly.length];
      if (segmentsCross(ax, ay, bx, by, p0.x, p0.y, p1.x, p1.y)) return true;
    }
    return false;
  });
}

/** `anyEdgeCrossesPolygon` for open runs: no edge back to the first vertex. */
function anyOpenEdgeCrossesPolygon(runs: readonly number[][], poly: readonly XY[]): boolean {
  for (const run of runs) {
    for (let i = 0; i + 3 < run.length; i += 2) {
      const ax = run[i], ay = run[i + 1], bx = run[i + 2], by = run[i + 3];
      for (let k = 0; k < poly.length; k++) {
        const p0 = poly[k], p1 = poly[(k + 1) % poly.length];
        if (segmentsCross(ax, ay, bx, by, p0.x, p0.y, p1.x, p1.y)) return true;
      }
    }
  }
  return false;
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

/** Returns true if (x, y) lies within the filled region of `path`. */
export function pathContainsPoint(
  path: GeomPath,
  x: number,
  y: number,
  opts: PointInPathOptions = {},
): boolean {
  return pointInPath(path, x, y, opts);
}

/** Returns true if `rect` is entirely contained within `path`. */
export function pathContainsRect(path: GeomPath, rect: Rect, opts: PointInPathOptions = {}): boolean {
  if (path.kind === 'rect') {
    return (
      rect.x >= path.x &&
      rect.y >= path.y &&
      rect.x + rect.width <= path.x + path.width &&
      rect.y + rect.height <= path.y + path.height
    );
  }
  const subpaths = closedSubpaths(path, opts);
  if (subpaths.length === 0) return false;
  for (const c of rectToVerts(rect)) {
    if (!pointInPath(path, c.x, c.y, opts)) return false;
  }
  // Every corner is filled, but any contour reaching into the rect — the
  // boundary of a hole, or a concave notch — leaves part of it unfilled.
  return !anyVertexInRect(subpaths, rect) && !anyEdgeCrossesRect(subpaths, rect);
}

/** Returns true if `rect` overlaps (intersects or contains) `path`. */
export function pathIntersectsRect(path: GeomPath, rect: Rect, opts: PointInPathOptions = {}): boolean {
  if (path.kind === 'rect') {
    return (
      rect.x < path.x + path.width &&
      rect.x + rect.width > path.x &&
      rect.y < path.y + path.height &&
      rect.y + rect.height > path.y
    );
  }
  const subpaths = closedSubpaths(path, opts);
  if (subpaths.length === 0) return false;
  for (const c of rectToVerts(rect)) {
    if (pointInPath(path, c.x, c.y, opts)) return true;
  }
  if (anyVertexInRect(subpaths, rect)) return true;
  return anyEdgeCrossesRect(subpaths, rect);
}

/** Returns true if every vertex of `polygon` lies inside `path`. */
export function pathContainsPolygon(
  path: GeomPath,
  polygon: readonly XY[],
  opts: PointInPathOptions = {},
): boolean {
  if (polygon.length === 0) return false;
  if (path.kind === 'rect') {
    return polygon.every(
      (p) =>
        p.x >= path.x &&
        p.x <= path.x + path.width &&
        p.y >= path.y &&
        p.y <= path.y + path.height,
    );
  }
  const subpaths = closedSubpaths(path, opts);
  if (subpaths.length === 0) return false;
  for (const p of polygon) {
    if (!pointInPath(path, p.x, p.y, opts)) return false;
  }
  return !anyVertexInPolygon(subpaths, flattenVerts(polygon)) &&
    !anyEdgeCrossesPolygon(subpaths, polygon);
}

/** Returns true if `polygon` overlaps (intersects or is contained by) `path`. */
export function pathIntersectsPolygon(
  path: GeomPath,
  polygon: readonly XY[],
  opts: PointInPathOptions = {},
): boolean {
  if (polygon.length === 0) return false;
  if (path.kind === 'rect') {
    return polygonsIntersect(rectToVerts(path), polygon);
  }
  const subpaths = closedSubpaths(path, opts);
  if (subpaths.length === 0) return false;
  for (const p of polygon) {
    if (pointInPath(path, p.x, p.y, opts)) return true;
  }
  if (anyVertexInPolygon(subpaths, flattenVerts(polygon))) return true;
  return anyEdgeCrossesPolygon(subpaths, polygon);
}

/**
 * Returns true if all of `path` — every subpath, open ones included, beziers
 * flattened — lies inside the closed `polygon`: the inverse of
 * {@link pathContainsPolygon}. A lasso enclosing a shape asks this.
 */
export function polygonContainsPath(
  polygon: readonly XY[],
  path: GeomPath,
  opts: PointInPathOptions = {},
): boolean {
  if (polygon.length < 3) return false;
  let subpaths: number[][];
  if (path.kind === 'rect') {
    subpaths = [flattenVerts(rectToVerts(path))];
  } else {
    const { closed, open } = flatSubpaths(path, opts.tolerance ?? DEFAULT_FLATTEN_TOLERANCE);
    subpaths = [...closed, ...open];
  }
  if (subpaths.length === 0) return false;
  const flatPoly = flattenVerts(polygon);
  for (const sub of subpaths) {
    for (let i = 0; i < sub.length; i += 2) {
      if (!pointInPolygon(flatPoly, sub[i], sub[i + 1])) return false;
    }
  }
  // Every vertex is inside, but a concave polygon can still cut an edge. An
  // open subpath is checked as if closed, so this can only err toward false.
  return !anyEdgeCrossesPolygon(subpaths, polygon);
}

/**
 * Returns true if any of `path` meets the closed `polygon`: its filled region,
 * or the line of an open subpath, which encloses nothing. Beziers are
 * flattened, so a control point off the curve never counts. The companion of
 * {@link polygonContainsPath}; a lasso touching a shape asks this.
 */
export function polygonIntersectsPath(
  polygon: readonly XY[],
  path: GeomPath,
  opts: PointInPathOptions = {},
): boolean {
  if (polygon.length < 3) return false;
  if (path.kind === 'rect') return polygonsIntersect(rectToVerts(path), polygon);
  const { closed, open } = flatSubpaths(path, opts.tolerance ?? DEFAULT_FLATTEN_TOLERANCE);
  const flatPoly = flattenVerts(polygon);
  if (anyVertexInPolygon(closed, flatPoly) || anyVertexInPolygon(open, flatPoly)) return true;
  if (anyEdgeCrossesPolygon(closed, polygon) || anyOpenEdgeCrossesPolygon(open, polygon)) {
    return true;
  }
  // No vertex inside and no crossing: the polygon lies wholly in one region
  // of the path, so one of its vertices decides whether that region is filled.
  return closed.length > 0 && pointInPath(path, polygon[0].x, polygon[0].y, opts);
}
