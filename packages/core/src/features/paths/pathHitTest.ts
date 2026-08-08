/**
 * Path-vs-geometry hit-test helpers. Five pure functions covering all
 * combinations of path-vs-point, path-vs-rect, and path-vs-polygon.
 *
 * `RectPath` short-circuits to AABB arithmetic. `PolygonPath` delegates to
 * the polygon kernel in `polygonHitTestRect` after extracting vertices from
 * the command stream. Bezier segments in a `PolygonPath` are currently out of
 * scope (paths are rect or straight-line polygon only); a non-line
 * command will throw to surface accidental misuse early.
 *
 * For point-in-path specifically, use the existing `pointInPath` from
 * `hitTest.ts` which handles beziers and fill rules correctly.
 */

import { pointInPolygon, segmentsCross } from '@weasel-js/geom';
import { pointInPath } from './hitTest';
import {
  polygonContainsRect,
  polygonIntersectsRect,
  type Vec2,
  type Rect,
} from 'core/geometry/polygonHitTestRect';
import {
  PATH_M,
  PATH_L,
  PATH_Z,
  type Path,
  type PolygonPath,
} from './types';

/**
 * Extract the vertices of the first closed subpath from a `PolygonPath`
 * command stream. Only `M`, `L`, and `Z` commands are supported — throws for
 * bezier commands, since Phase-2 clip paths are straight-line polygons.
 */
function extractVertices(path: PolygonPath): Vec2[] {
  const { commands, coords } = path;
  const verts: Vec2[] = [];
  let ci = 0;
  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    if (cmd === PATH_M || cmd === PATH_L) {
      verts.push({ x: coords[ci], y: coords[ci + 1] });
      ci += 2;
    } else if (cmd === PATH_Z) {
      // End of first subpath — we have enough.
      break;
    } else {
      throw new Error(
        `pathHitTest: bezier command ${cmd} not supported — promote path to use pointInPath for bezier paths`,
      );
    }
  }
  return verts;
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

/** Convex/concave polygon containment: every vertex of `inner` lies inside `outer`. */
function polygonContainsPolygon(outer: readonly Vec2[], inner: readonly Vec2[]): boolean {
  if (inner.length === 0) return false; // empty inner can't be "contained"
  const flatOuter = flattenVerts(outer);
  return inner.every((p) => pointInPolygon(flatOuter, p.x, p.y));
}

/** Edge-vs-edge segment intersection check. */
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

// ─── Public API ─────────────────────────────────────────────────────────────

/** Returns true if (x, y) lies within the filled region of `path`. */
export function pathContainsPoint(path: Path, x: number, y: number): boolean {
  // Delegate to the canonical implementation which handles fill rules and
  // beziers. For RectPath this is an O(1) AABB test.
  return pointInPath(path, x, y);
}

/** Returns true if `rect` is entirely contained within `path`. */
export function pathContainsRect(path: Path, rect: Rect): boolean {
  if (path.kind === 'rect') {
    return (
      rect.x >= path.x &&
      rect.y >= path.y &&
      rect.x + rect.width <= path.x + path.width &&
      rect.y + rect.height <= path.y + path.height
    );
  }
  return polygonContainsRect(extractVertices(path), rect);
}

/** Returns true if `rect` overlaps (intersects or contains) `path`. */
export function pathIntersectsRect(path: Path, rect: Rect): boolean {
  if (path.kind === 'rect') {
    return (
      rect.x < path.x + path.width &&
      rect.x + rect.width > path.x &&
      rect.y < path.y + path.height &&
      rect.y + rect.height > path.y
    );
  }
  return polygonIntersectsRect(extractVertices(path), rect);
}

/** Returns true if every vertex of `polygon` lies inside `path`. */
export function pathContainsPolygon(path: Path, polygon: readonly Vec2[]): boolean {
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
  return polygonContainsPolygon(extractVertices(path), polygon);
}

/** Returns true if `polygon` overlaps (intersects or is contained by) `path`. */
export function pathIntersectsPolygon(path: Path, polygon: readonly Vec2[]): boolean {
  if (path.kind === 'rect') {
    return polygonsIntersect(rectToVerts(path), polygon);
  }
  return polygonsIntersect(extractVertices(path), polygon);
}
