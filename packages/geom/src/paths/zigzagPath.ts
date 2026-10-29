/**
 * Zigzag a path: evenly spaced points laid along each segment, and every
 * point of the outline pushed alternately to one side of it and the other.
 */
import type { Path } from '../path';
import { countParam, polylineContour, sampleContour } from './contourSamples';
import { cubicContoursToPath, pathToCubicContours, type CubicContour } from './cubicContours';
import type { Point } from './cubicMath';

/** How a path is zigzagged. */
export interface ZigzagPathOptions {
  /** How far each point is pushed off the outline, in the path's units. */
  size: number;
  /** Points added to each segment. Default 4. */
  ridges?: number;
  /** Run a curve through the pushed points instead of meeting at sharp
   *  corners there. Default `false`. */
  smooth?: boolean;
}

/**
 * `path` with `ridges` points added to each segment and every point, anchors
 * included, pushed `size` along the outline's normal, the side alternating
 * from one point to the next. A `size` of zero answers `path` itself.
 */
export function zigzagPath(path: Path, opts: ZigzagPathOptions): Path {
  const { size, smooth = false } = opts;
  if (!(size !== 0 && Number.isFinite(size))) return path;
  const pieces = countParam(opts.ridges, 4) + 1;
  const contours = pathToCubicContours(path).map((contour) => {
    let normal: Point = { x: 0, y: 0 };
    const points = sampleContour(contour, pieces).map(({ at, dir }, i) => {
      // A point where the outline has no direction keeps the one before's normal.
      if (dir) normal = { x: -dir.y, y: dir.x };
      const side = i % 2 === 0 ? size : -size;
      return { x: at.x + normal.x * side, y: at.y + normal.y * side };
    });
    return smooth ? smoothThrough(points, contour.closed) : polylineContour(points, contour.closed);
  });
  return cubicContoursToPath(contours, path.kind === 'polygon' ? path.fillRule : 'nonzero');
}

/** A Catmull-Rom curve through `points`: each one's handles parallel to the
 *  line between its neighbors. An open run's ends stand in for their own
 *  missing neighbor. */
function smoothThrough(points: readonly Point[], closed: boolean): CubicContour {
  const n = points.length;
  const at = (i: number): Point => (closed ? points[(i + n) % n]! : points[Math.max(0, Math.min(n - 1, i))]!);
  const reach = (i: number): Point => ({ x: (at(i + 1).x - at(i - 1).x) / 6, y: (at(i + 1).y - at(i - 1).y) / 6 });
  const segs: CubicContour['segs'] = [];
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = at(i);
    const b = at(i + 1);
    const ra = reach(i);
    const rb = reach(i + 1);
    segs.push({ c: [a.x, a.y, a.x + ra.x, a.y + ra.y, b.x - rb.x, b.y - rb.y, b.x, b.y], line: false });
  }
  return { segs, closed };
}
