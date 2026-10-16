/** Where paths cross one another and themselves. */

import type { Path } from '../path';
import { intersectSegments } from './segmentIntersections';
import { adjacentSegments, boxesNear, pathSegments, type PathSegment } from './pathSegments';

/** A place on a path's stroke: which segment, and how far along it. */
export interface PathStop {
  /** Index of the path in the list it came from. */
  path: number;
  sub: number;
  /** Segment index within the subpath. */
  index: number;
  /** Parameter on that segment, in [0, 1]. */
  t: number;
}

/** A point where two strokes cross or touch, and where it falls on each. */
export interface PathCrossing {
  x: number;
  y: number;
  a: PathStop;
  b: PathStop;
}

const END = 1e-9;

/** Whether a hit between neighboring segments is just their shared end. */
function sharedEnd(a: PathSegment, b: PathSegment, ta: number, tb: number): boolean {
  if (!adjacentSegments(a, b)) return false;
  return (ta > 1 - END && tb < END) || (ta < END && tb > 1 - END);
}

/**
 * Every crossing among `paths`: between each pair, and — unless `self` is
 * false — of a path with itself, leaving out the joint where one segment
 * meets the next. Points where strokes merely touch count too. With `of`,
 * only the crossings involving that one path.
 */
export function pathCrossings(paths: readonly Path[], opts: { self?: boolean; of?: number } = {}): PathCrossing[] {
  const segs = paths.map(pathSegments);
  const out: PathCrossing[] = [];
  for (let i = 0; i < segs.length; i++) {
    for (let j = i; j < segs.length; j++) {
      if (i === j && opts.self === false) continue;
      if (opts.of !== undefined && i !== opts.of && j !== opts.of) continue;
      for (let m = 0; m < segs[i].length; m++) {
        for (let n = i === j ? m + 1 : 0; n < segs[j].length; n++) {
          const sa = segs[i][m], sb = segs[j][n];
          if (!boxesNear(sa.box, sb.box)) continue;
          for (const h of intersectSegments(sa.pts, sb.pts)) {
            if (i === j && sharedEnd(sa, sb, h.ta, h.tb)) continue;
            out.push({
              x: h.x,
              y: h.y,
              a: { path: i, sub: sa.sub, index: sa.index, t: h.ta },
              b: { path: j, sub: sb.sub, index: sb.index, t: h.tb },
            });
          }
        }
      }
    }
  }
  return out;
}

/** Where `path`'s stroke is crossed, by `cutters` and by itself, as stops on
 *  `path` (each with `path: 0`) — the cuts a trim chooses between. */
export function crossingStops(path: Path, cutters: readonly Path[]): PathStop[] {
  const stops: PathStop[] = [];
  for (const c of pathCrossings([path, ...cutters], { of: 0 })) {
    if (c.a.path === 0) stops.push(c.a);
    if (c.b.path === 0) stops.push(c.b);
  }
  return stops;
}
