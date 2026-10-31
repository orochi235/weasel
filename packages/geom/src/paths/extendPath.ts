/**
 * Growing an open end of a path along the curve a `LengthenMode` draws: by a
 * distance, or until it meets another stroke.
 */

import type { Path, PolygonPath } from '../path';
import type { Point } from './cubicMath';
import { intersectSegments } from '../intersect/segmentIntersections';
import { pathSegments, type PathSegment } from '../intersect/pathSegments';
import { editAnchorSetTracked } from './anchorOrigins';
import { anchorsToPath, pathToAnchors } from './anchors';
import { resolveCorners } from './corners';
import { lengthenPathEnd, pathEndFrame } from './lengthenPathEnd';
import { easeLength, extensionPieces, pieceLengthAt, type EaseOptions, type LengthenMode } from './pathEndExtension';

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
 * `path` with `end` carried `distance` further, by `lengthenPathEnd` in `mode`
 * (default `'tangent'`): a straight end grown straight gets longer, and
 * anything else gains segments that keep the tangent continuous. Null when the
 * end is not open or has no direction, or `distance` is not positive.
 */
export function lengthenOpenEnd(
  path: Path, end: OpenPathEnd, distance: number, mode: LengthenMode = 'tangent', opts: EaseOptions = {},
): PolygonPath | null {
  if (!(distance > 0) || path.kind !== 'polygon') return null;
  return editAnchorSetTracked(path, (set) => lengthenPathEnd(set, end, distance, mode, opts))?.path ?? null;
}

/** Options for {@link extendToMeet}. */
export interface ExtendToMeetOptions extends EaseOptions {
  /** The furthest the end may travel, by arc length. Default: as far as any stroke reaches. */
  maxDistance?: number;
  /** The curve the end travels along. Default `'eased'`. */
  mode?: LengthenMode;
}

/**
 * Extend `end` of `path` along the curve `opts.mode` draws to the first stroke
 * it meets — one of `boundaries`, or `path`'s own other segments. Returns the
 * extended path, the point it now ends at and how far it went by arc length,
 * or null when the curve meets nothing.
 */
export function extendToMeet(
  path: Path,
  boundaries: readonly Path[],
  end: OpenPathEnd,
  opts: ExtendToMeetOptions = {},
): { path: PolygonPath; at: Point; distance: number } | null {
  if (path.kind !== 'polygon') return null;
  const frame = pathEndFrame(pathToAnchors(path), end);
  if (!frame) return null;
  const mode = opts.mode ?? 'eased';
  const all = [...boundaries.flatMap((b) => pathSegments(b)), ...segmentsBesideEnd(path, end)];
  let reach = opts.maxDistance ?? 0;
  if (opts.maxDistance === undefined) {
    for (const s of all) {
      for (const p of s.pts) reach = Math.max(reach, Math.hypot(p.x - frame.point.x, p.y - frame.point.y));
    }
    // A curve bends away before it runs straight: let the straight run cover the reach on its own.
    if (mode === 'eased') reach += Math.min(easeLength(frame, opts), reach);
    if (mode === 'curvature') reach = Infinity;
  }
  if (!(reach > 0)) return null;
  let best: number | null = null;
  let walked = 0;
  for (const piece of extensionPieces(frame, reach, mode, opts)) {
    for (const s of all) {
      for (const h of intersectSegments(piece.pts, s.pts)) {
        const d = walked + pieceLengthAt(piece, h.ta);
        if (d > 1e-6 && (best === null || d < best)) best = d;
      }
    }
    if (best !== null) break;
    walked += piece.length;
  }
  if (best === null) return null;
  const next = lengthenOpenEnd(path, end, best, mode, opts);
  const at = next && pathEndFrame(pathToAnchors(next), end)?.point;
  return next && at ? { path: next, at, distance: best } : null;
}
