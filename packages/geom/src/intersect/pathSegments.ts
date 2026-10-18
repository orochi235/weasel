/** A path's stroke as a flat list of segments, each knowing where it sits. */

import type { Path } from '../path';
import { parseSubpaths } from '../booleans/contours';
import type { Point } from '../paths/cubicMath';

/** One segment of a path's stroke, in the order the path draws them. */
export interface PathSegment {
  /** Control points: 2 for a line, 3 for a quadratic, 4 for a cubic. */
  pts: Point[];
  /** Index of its subpath among the path's subpaths. */
  sub: number;
  /** Index within its subpath. */
  index: number;
  /** Segments in its subpath. */
  count: number;
  /** Whether its subpath is closed, so its last segment meets its first. */
  closed: boolean;
  /** Axis-aligned box of the control points, which holds the segment. */
  box: { x0: number; y0: number; x1: number; y1: number };
}

/** `path`'s stroke as segments: a closed subpath includes its closing edge,
 *  an open one does not, and a zero-length line is left out. */
export function pathSegments(path: Path): PathSegment[] {
  const out: PathSegment[] = [];
  parseSubpaths(path, false).forEach(({ segs, closed }, sub) => {
    segs.forEach((pts, index) => {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const p of pts) {
        x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
        y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
      }
      out.push({ pts, sub, index, count: segs.length, closed, box: { x0, y0, x1, y1 } });
    });
  });
  return out;
}

/** Whether two boxes overlap or touch. */
export function boxesNear(a: PathSegment['box'], b: PathSegment['box']): boolean {
  return a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1;
}

/** Whether segments `a` and `b` of one path follow each other, so they meet
 *  at a shared end that is no crossing. */
export function adjacentSegments(a: PathSegment, b: PathSegment): boolean {
  if (a.sub !== b.sub) return false;
  const d = Math.abs(a.index - b.index);
  return d === 1 || (a.closed && d === a.count - 1);
}
