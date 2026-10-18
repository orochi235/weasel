/**
 * Growing an open end of a path along its tangent: by a distance, or until it
 * meets another stroke.
 */

import type { Path, PolygonPath } from '../path';
import type { Point } from './cubicMath';
import type { Seg } from '../booleans/contourSegments';
import { intersectSegments } from '../intersect/segmentIntersections';
import { pathSegments, type PathSegment } from '../intersect/pathSegments';
import { editAnchorSetTracked } from './anchorOrigins';
import { anchorsToPath, pathToAnchors } from './anchors';
import { resolveCorners } from './corners';
import { lengthenPathEnd, pathEndFrame } from './lengthenPathEnd';

/** One end of an open subpath. `sub` counts subpaths as the path's anchor set
 *  (`pathToAnchors`) does, a bare `M` included. */
export interface OpenPathEnd {
  sub: number;
  end: 'first' | 'last';
}

/** Every end of every open subpath of `path` that has a direction to grow in. */
export function openPathEnds(path: Path): OpenPathEnd[] {
  if (path.kind !== 'polygon') return [];
  const set = pathToAnchors(path);
  return set.anchors.flatMap((_, sub) =>
    (['first', 'last'] as const).map((end) => ({ sub, end })).filter((e) => pathEndFrame(set, e)));
}

/** Where `end` sits and the unit direction it points out along, or null when
 *  it is no open end or has no direction there. */
export function openEndRay(path: Path, end: OpenPathEnd): { at: Point; dir: Point } | null {
  if (path.kind !== 'polygon') return null;
  const frame = pathEndFrame(pathToAnchors(path), end);
  return frame && { at: frame.point, dir: frame.tangent };
}

/** `path`'s stroke segments but the one at `end`. */
function segmentsBesideEnd(path: PolygonPath, end: OpenPathEnd): PathSegment[] {
  const set = pathToAnchors(resolveCorners(path));
  return set.anchors.flatMap((sub, s) => {
    const segs = pathSegments(anchorsToPath([sub], [set.closed[s]]));
    return s === end.sub ? segs.filter((g) => g.index !== (end.end === 'last' ? g.count - 1 : 0)) : segs;
  });
}

/**
 * `path` with `end` carried `distance` further along its tangent, by
 * `lengthenPathEnd` in `'tangent'` mode: a straight end segment grows longer,
 * and a curved one gains a straight segment, which keeps the tangent
 * continuous. Null when the end is not open or has no direction, or
 * `distance` is not positive.
 */
export function lengthenOpenEnd(path: Path, end: OpenPathEnd, distance: number): PolygonPath | null {
  if (!(distance > 0) || path.kind !== 'polygon') return null;
  return editAnchorSetTracked(path, (set) => lengthenPathEnd(set, end, distance, 'tangent'))?.path ?? null;
}

/** Options for {@link extendToMeet}. */
export interface ExtendToMeetOptions {
  /** The furthest the end may travel. Default: as far as any stroke reaches. */
  maxDistance?: number;
}

/**
 * Extend `end` of `path` along its tangent to the first stroke it meets —
 * one of `boundaries`, or `path`'s own other segments. Returns the extended
 * path, the point it now ends at and how far it went, or null when the
 * tangent meets nothing.
 */
export function extendToMeet(
  path: Path,
  boundaries: readonly Path[],
  end: OpenPathEnd,
  opts: ExtendToMeetOptions = {},
): { path: PolygonPath; at: Point; distance: number } | null {
  const ray = openEndRay(path, end);
  if (!ray || path.kind !== 'polygon') return null;
  const all = [...boundaries.flatMap((b) => pathSegments(b)), ...segmentsBesideEnd(path, end)];
  let reach = opts.maxDistance ?? 0;
  if (opts.maxDistance === undefined) {
    for (const s of all) {
      for (const p of s.pts) reach = Math.max(reach, Math.hypot(p.x - ray.at.x, p.y - ray.at.y));
    }
  }
  if (!(reach > 0)) return null;
  const line: Seg = [ray.at, { x: ray.at.x + ray.dir.x * reach, y: ray.at.y + ray.dir.y * reach }];
  let best = Infinity;
  for (const s of all) {
    for (const h of intersectSegments(line, s.pts)) {
      const d = h.ta * reach;
      if (d > 1e-6 && d < best) best = d;
    }
  }
  if (!Number.isFinite(best)) return null;
  const next = lengthenOpenEnd(path, end, best);
  if (!next) return null;
  return { path: next, at: { x: ray.at.x + ray.dir.x * best, y: ray.at.y + ray.dir.y * best }, distance: best };
}
