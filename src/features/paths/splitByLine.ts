// src/features/paths/splitByLine.ts
import type { Path, PolygonPath, PathFillRule } from './types';
import { boundsOfPath } from './bounds';
import { extractPolylines } from './tessellate/polyline';
import { pathIntersect } from './booleans';
import { polygonFromPoints } from './builder';

export interface Point { x: number; y: number; }
export interface SplitByLineOptions {
  /** Polyline flattening tolerance for the boundary-crossing gate. */
  flattenTolerance?: number;
}

/** Proper segment intersection (excludes collinear / shared-endpoint touches). */
function segmentsProperlyCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const s = (p: Point, q: Point, r: Point) =>
    Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  const d1 = s(c, d, a), d2 = s(c, d, b), d3 = s(a, b, c), d4 = s(a, b, d);
  return d1 !== d2 && d3 !== d4;
}

/** Count how many boundary edges the finite segment a->b properly crosses. */
function countBoundaryCrossings(path: Path, a: Point, b: Point, tol: number): number {
  let n = 0;
  for (const pl of extractPolylines(path, { flattenTolerance: tol })) {
    const pts = pl.points;
    const count = pts.length / 2;
    const last = pl.closed ? count : count - 1;
    for (let i = 0; i < last; i++) {
      const j = (i + 1) % count;
      const c = { x: pts[i * 2], y: pts[i * 2 + 1] };
      const dd = { x: pts[j * 2], y: pts[j * 2 + 1] };
      if (segmentsProperlyCross(a, b, c, dd)) n++;
    }
  }
  return n;
}

/**
 * Split `path` along the finite segment a->b into closed pieces (Knife).
 *
 * Returns `null` unless the segment enters AND exits the path boundary
 * (>=2 proper crossings) and both half-planes yield non-empty area. Otherwise
 * returns one `PolygonPath` per side of the line. Beziers are flattened
 * (see `pathIntersect`). The infinite line is used *within* a gated shape, so a
 * concave shape only partly crossed may be cut at far-side crossings - accepted
 * (see spec non-goals).
 */
export function splitPathByLine(
  path: Path,
  a: Point,
  b: Point,
  opts: SplitByLineOptions = {},
): Path[] | null {
  const tol = opts.flattenTolerance ?? 0.5;
  if (a.x === b.x && a.y === b.y) return null;
  if (countBoundaryCrossings(path, a, b, tol) < 2) return null;

  // Line direction + normal.
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;     // unit along the line
  const nx = -uy, ny = ux;                // unit normal

  // Build two large half-plane quads sized to the padded AABB so each fully
  // covers the path on one side of the line.
  const bb = boundsOfPath(path);
  const R = (Math.hypot(bb.width, bb.height) + 1) * 4; // generous half-extent
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const p0 = { x: mid.x - ux * R, y: mid.y - uy * R };
  const p1 = { x: mid.x + ux * R, y: mid.y + uy * R };
  const sideQuad = (sign: 1 | -1): PolygonPath =>
    polygonFromPoints([
      p0,
      p1,
      { x: p1.x + nx * R * sign, y: p1.y + ny * R * sign },
      { x: p0.x + nx * R * sign, y: p0.y + ny * R * sign },
    ]);

  const fillRule: PathFillRule = path.kind === 'polygon' ? path.fillRule : 'nonzero';
  const sideA = withFillRule(pathIntersect(path, sideQuad(1)), fillRule);
  const sideB = withFillRule(pathIntersect(path, sideQuad(-1)), fillRule);

  // Drop empty or degenerate pieces (zero commands, or near-zero AABB area).
  const isSubstantial = (p: PolygonPath): boolean => {
    if (p.commands.length === 0) return false;
    const bb2 = boundsOfPath(p);
    return bb2.width * bb2.height >= 1e-6;
  };

  const pieces = [sideA, sideB].filter(isSubstantial);
  return pieces.length === 2 ? pieces : null;
}

function withFillRule(p: PolygonPath, fillRule: PathFillRule): PolygonPath {
  return p.fillRule === fillRule ? p : { ...p, fillRule };
}
