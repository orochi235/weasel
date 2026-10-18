/**
 * Trim: remove the piece of a stroke between the crossings on either side of
 * a point, as a drafting trim does.
 */

import type { Path, PolygonPath } from '../path';
import type { Point } from './cubicMath';
import { evalSeg, subSeg, type Seg } from '../booleans/contourSegments';
import { parseSubpaths } from '../booleans/contours';
import { nearestOnCubic, nearestOnLine, nearestOnQuadratic } from '../nearest';
import { crossingStops } from '../intersect/pathCrossings';
import { writeSubpaths, type SegmentRun } from '../intersect/writeSubpaths';
import { keepCorners } from './cornerRestore';

/** Options for {@link trimPathAt}. */
export interface TrimPathOptions {
  /** How far from the stroke `probe` may be. Default: any distance. */
  radius?: number;
}

/** What {@link trimPathAt} did. */
export interface TrimResult {
  /** The path with the piece gone; it has no commands when nothing is left. */
  path: PolygonPath;
  /** The piece removed, as an open path. */
  removed: PolygonPath;
}

const EDGE = 1e-7;

function nearestOn(s: Seg, p: Point): { t: number; dist: number } {
  if (s.length === 2) return nearestOnLine(p.x, p.y, s[0].x, s[0].y, s[1].x, s[1].y);
  if (s.length === 3) return nearestOnQuadratic(p.x, p.y, s[0].x, s[0].y, s[1].x, s[1].y, s[2].x, s[2].y);
  return nearestOnCubic(p.x, p.y, s[0].x, s[0].y, s[1].x, s[1].y, s[2].x, s[2].y, s[3].x, s[3].y);
}

/** The stretch of `segs` between run positions `a` and `b`, where position
 *  `k + t` is parameter `t` on segment `k`. On a closed run `b` may pass the
 *  end and wrap round. */
function stretch(segs: readonly Seg[], a: number, b: number): Seg[] {
  const n = segs.length;
  const out: Seg[] = [];
  for (let k = Math.floor(a); k < b; k++) {
    const s = segs[((k % n) + n) % n];
    const t0 = Math.max(0, a - k), t1 = Math.min(1, b - k);
    if (t1 - t0 <= EDGE) continue;
    const piece = subSeg(s, t0, t1, evalSeg(s, t0), evalSeg(s, t1));
    if (piece) out.push(piece);
  }
  return out;
}

/**
 * Remove the piece of `path`'s stroke that `probe` is nearest, bounded by the
 * nearest crossings on either side — with any of `cutters`, or with the path
 * itself. On an open subpath an end with no crossing before it bounds the
 * piece too, so a subpath touched only at its ends goes whole; a closed
 * subpath is opened, and one crossed at a single point is removed whole.
 *
 * Returns null when the probe is further than `radius` from the stroke, or
 * when nothing crosses or touches the subpath it is on. Curves are split where they are
 * cut and keep their type; other subpaths are left as they were.
 */
export function trimPathAt(
  path: Path,
  cutters: readonly Path[],
  probe: Point,
  opts: TrimPathOptions = {},
): TrimResult | null {
  const subs = parseSubpaths(path, false);
  let hit: { sub: number; at: number; dist: number } | null = null;
  subs.forEach(({ segs }, sub) => segs.forEach((s, k) => {
    const n = nearestOn(s, probe);
    if (!hit || n.dist < hit.dist) hit = { sub, at: k + n.t, dist: n.dist };
  }));
  const found = hit as { sub: number; at: number; dist: number } | null;
  if (!found || found.dist > (opts.radius ?? Infinity)) return null;

  const { segs, closed } = subs[found.sub];
  const n = segs.length;
  const touches = crossingStops(path, cutters)
    .filter((s) => s.sub === found.sub)
    .map((s) => s.index + s.t);
  if (touches.length === 0) return null;
  const stops = touches
    .map((s) => (closed && s > n - EDGE ? 0 : s))
    .filter((s) => closed || (s > EDGE && s < n - EDGE))
    .sort((p, q) => p - q);

  const below = stops.filter((s) => s < found.at);
  const above = stops.filter((s) => s > found.at);
  const keep: SegmentRun[] = [];
  let removed: Seg[];
  if (closed) {
    if (stops.length === 0) return null;
    const lo = below.length > 0 ? below[below.length - 1] : stops[stops.length - 1] - n;
    const hi = above.length > 0 ? above[0] : stops[0] + n;
    removed = stretch(segs, lo, hi);
    if (hi < lo + n - EDGE) keep.push({ segs: stretch(segs, hi, lo + n), closed: false });
  } else {
    const lo = below.length > 0 ? below[below.length - 1] : 0;
    const hi = above.length > 0 ? above[0] : n;
    removed = stretch(segs, lo, hi);
    if (lo > EDGE) keep.push({ segs: stretch(segs, 0, lo), closed: false });
    if (hi < n - EDGE) keep.push({ segs: stretch(segs, hi, n), closed: false });
  }

  const runs: SegmentRun[] = [];
  subs.forEach((s, i) => {
    if (i === found.sub) runs.push(...keep);
    else runs.push({ segs: s.segs, closed: s.closed });
  });
  return {
    path: keepCorners([path], writeSubpaths(runs, path)),
    removed: writeSubpaths([{ segs: removed, closed: false }], path),
  };
}
