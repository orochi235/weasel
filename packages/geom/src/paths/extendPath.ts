/**
 * Growing an open end of a path along its tangent: by a distance, or until it
 * meets another stroke.
 */

import type { Path, PolygonPath } from '../path';
import type { Point } from './cubicMath';
import type { Seg } from '../booleans/contourSegments';
import { parseSubpaths } from '../booleans/contours';
import { intersectSegments } from '../intersect/segmentIntersections';
import { pathSegments } from '../intersect/pathSegments';
import { writeSubpaths } from '../intersect/writeSubpaths';

/** One end of an open subpath. */
export interface OpenPathEnd {
  sub: number;
  end: 'first' | 'last';
}

/** Every end of every open subpath of `path` that has a segment behind it. */
export function openPathEnds(path: Path): OpenPathEnd[] {
  return parseSubpaths(path, false).flatMap(({ segs, closed }, sub) =>
    closed || segs.length === 0 ? [] : [{ sub, end: 'first' as const }, { sub, end: 'last' as const }]);
}

/** Where `end` sits and the unit direction it points out along, or null when
 *  its segment has no length to point with. */
export function openEndRay(path: Path, end: OpenPathEnd): { at: Point; dir: Point } | null {
  const sp = parseSubpaths(path, false)[end.sub];
  if (!sp || sp.closed || sp.segs.length === 0) return null;
  const s = end.end === 'last' ? sp.segs[sp.segs.length - 1] : sp.segs[0].slice().reverse();
  const at = s[s.length - 1];
  // The tangent at an end runs to the nearest control point that is not on it.
  for (let i = s.length - 2; i >= 0; i--) {
    const dx = at.x - s[i].x, dy = at.y - s[i].y;
    const len = Math.hypot(dx, dy);
    if (len > 1e-9) return { at: { ...at }, dir: { x: dx / len, y: dy / len } };
  }
  return null;
}

/**
 * `path` with `end` carried `distance` further along its tangent. A straight
 * end segment grows longer; a curved one gains a straight segment, which
 * keeps the tangent continuous. Null when the end is not open or has no
 * direction, or `distance` is not positive.
 */
export function lengthenOpenEnd(path: Path, end: OpenPathEnd, distance: number): PolygonPath | null {
  if (!(distance > 0)) return null;
  const ray = openEndRay(path, end);
  if (!ray) return null;
  const subs = parseSubpaths(path, false);
  const segs = subs[end.sub].segs.slice();
  const to = { x: ray.at.x + ray.dir.x * distance, y: ray.at.y + ray.dir.y * distance };
  if (end.end === 'last') {
    const last = segs[segs.length - 1];
    if (last.length === 2) segs[segs.length - 1] = [last[0], to];
    else segs.push([last[last.length - 1], to]);
  } else {
    const first = segs[0];
    if (first.length === 2) segs[0] = [to, first[1]];
    else segs.unshift([to, first[0]]);
  }
  return writeSubpaths(subs.map((s, i) => (i === end.sub ? { segs, closed: false } : s)), path);
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
  if (!ray) return null;
  const others = boundaries.flatMap((b) => pathSegments(b));
  const own = pathSegments(path);
  const ownEnd = (s: (typeof own)[number]) =>
    s.sub === end.sub && s.index === (end.end === 'last' ? s.count - 1 : 0);
  const all = [...others, ...own.filter((s) => !ownEnd(s))];
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
