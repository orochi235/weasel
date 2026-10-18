import type { Path } from '../path';
import type { Point } from '../paths/cubicMath';
import { flattenCubic, flattenQuadratic } from '../flatten';
import { parseSubpaths } from './contours';
import { snipPathByPolyline } from './splitBySegment';
import { keepCorners } from '../paths/cornerRestore';

/** Options for {@link snipPathsAtCrossings}. */
export interface SnipAtCrossingsOptions {
  /** How closely a cutting path's curves are followed when they are flattened
   *  to find where they cross. Default 0.05. */
  flattenTolerance?: number;
}

/**
 * Cut the stroke of every path in `paths` wherever another of them crosses
 * it, as {@link snipPathByPolyline} cuts along one polyline: an open subpath
 * becomes open runs between crossings, and a closed one is opened at them.
 * A path is not cut where it crosses itself.
 *
 * Answers one entry per path, in order: its pieces, or `null` when no other
 * path crosses it. The cutting paths' curves are flattened, so a crossing on
 * a curve is found to within `flattenTolerance`; the pieces keep their own
 * segment types.
 */
export function snipPathsAtCrossings(
  paths: readonly Path[],
  opts: SnipAtCrossingsOptions = {},
): (Path[] | null)[] {
  const tol = opts.flattenTolerance ?? 0.05;
  const cuts = paths.map((p) => cutLinesOf(p, tol));
  return paths.map((path, i) => {
    let pieces: Path[] = [path];
    let cut = false;
    cuts.forEach((lines, j) => {
      if (j === i) return;
      for (const line of lines) {
        pieces = pieces.flatMap((piece) => {
          const snipped = snipPathByPolyline(piece, line);
          if (!snipped) return [piece];
          cut = true;
          return snipped;
        });
      }
    });
    return cut ? pieces.map((piece) => (piece.kind === 'polygon' ? keepCorners([path], piece) : piece)) : null;
  });
}

/** `path`'s subpaths as polylines, a closed one ending where it began. */
function cutLinesOf(path: Path, tol: number): Point[][] {
  return parseSubpaths(path, false).map(({ segs, closed }) => {
    const flat: number[] = [segs[0][0].x, segs[0][0].y];
    for (const s of segs) {
      if (s.length === 2) flat.push(s[1].x, s[1].y);
      else if (s.length === 3) flattenQuadratic(s[0].x, s[0].y, s[1].x, s[1].y, s[2].x, s[2].y, tol, flat);
      else flattenCubic(s[0].x, s[0].y, s[1].x, s[1].y, s[2].x, s[2].y, s[3].x, s[3].y, tol, flat);
    }
    const pts: Point[] = [];
    for (let k = 0; k < flat.length; k += 2) pts.push({ x: flat[k], y: flat[k + 1] });
    if (closed) {
      const end = pts[pts.length - 1];
      if (end.x !== pts[0].x || end.y !== pts[0].y) pts.push({ ...pts[0] });
    }
    return pts;
  });
}
