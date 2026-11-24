/** Where paths cross one another and themselves. */

import type { Path } from '../path';
import { segmentCrossings, segmentSelfCrossing } from './segmentIntersections';
import { boxesNear, pathSegments, type PathSegment } from './pathSegments';

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

/** `stop` on segment `seg`, with a segment's end written as the next one's start, so a joint has one name. */
function canonical(seg: PathSegment, path: number, t: number): PathStop {
  const next = seg.index + 1 < seg.count ? seg.index + 1 : seg.closed ? 0 : -1;
  if (t > 1 - END && next >= 0) return { path, sub: seg.sub, index: next, t: 0 };
  return { path, sub: seg.sub, index: seg.index, t };
}

const sameStop = (a: PathStop, b: PathStop): boolean =>
  a.path === b.path && a.sub === b.sub && a.index === b.index && Math.abs(a.t - b.t) < END;

/** Which crossings {@link pathCrossings} reports. */
export interface PathCrossingsOptions {
  /** False leaves out where a path crosses itself. Default true. */
  self?: boolean;
  /** Only the crossings involving `paths[of]`. */
  of?: number;
}

/**
 * Every crossing among `paths`: between each pair, and of a path with itself,
 * leaving out the joint where one segment meets the next. Points where strokes
 * merely touch count too.
 */
export function pathCrossings(paths: readonly Path[], opts: PathCrossingsOptions = {}): PathCrossing[] {
  const segs = paths.map(pathSegments);
  const out: PathCrossing[] = [];
  const seen: [PathStop, PathStop][] = [];
  // A crossing at a joint is found once from each segment meeting there; report it once, and a joint of a path
  // with itself not at all.
  const add = (i: number, sa: PathSegment, ta: number, j: number, sb: PathSegment, tb: number, x: number, y: number) => {
    const ca = canonical(sa, i, ta), cb = canonical(sb, j, tb);
    if (sameStop(ca, cb)) return;
    if (seen.some(([u, v]) => (sameStop(u, ca) && sameStop(v, cb)) || (sameStop(u, cb) && sameStop(v, ca)))) return;
    seen.push([ca, cb]);
    out.push({
      x, y,
      a: { path: i, sub: sa.sub, index: sa.index, t: ta },
      b: { path: j, sub: sb.sub, index: sb.index, t: tb },
    });
  };
  for (let i = 0; i < segs.length; i++) {
    for (let j = i; j < segs.length; j++) {
      if (i === j && opts.self === false) continue;
      if (opts.of !== undefined && i !== opts.of && j !== opts.of) continue;
      for (let m = 0; m < segs[i].length; m++) {
        const sa = segs[i][m];
        const own = i === j ? segmentSelfCrossing(sa.pts) : null;
        if (own) add(i, sa, own.ta, i, sa, own.tb, own.x, own.y);
        for (let n = i === j ? m + 1 : 0; n < segs[j].length; n++) {
          const sb = segs[j][n];
          if (!boxesNear(sa.box, sb.box)) continue;
          for (const h of segmentCrossings(sa.pts, sb.pts)) add(i, sa, h.ta, j, sb, h.tb, h.x, h.y);
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
