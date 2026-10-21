/**
 * Geometric snapping onto paths: the points on a set of strokes a drawn or
 * dragged point can lock to, and which of them a probe lands on.
 */

import type { Path } from '../path';
import type { Point } from '../paths/cubicMath';
import { evalSeg, type Seg } from '../booleans/contourSegments';
import { nearestOnCubic, nearestOnLine, nearestOnQuadratic } from '../nearest';
import { pathCrossings } from '../intersect/pathCrossings';
import { intersectSegments } from '../intersect/segmentIntersections';
import { pathSegments, type PathSegment } from '../intersect/pathSegments';
import { perpendicularTsFrom, segmentExtremaT, segmentMidT, tangentTsFrom } from './segmentFeatures';

/**
 * What a snap target is.
 *
 * - `anchor` — an end of a segment: a path's anchors, a box's corners.
 * - `center` — a point a caller names as the middle of something: a text or
 *   image box's center, given to {@link createPathSnapIndex} as a target.
 * - `intersection` — where two strokes cross, or one crosses itself.
 * - `tangent` — where a line from the query's origin touches a curve.
 * - `perpendicular` — where a line from the origin meets a stroke square on.
 * - `midpoint` — the middle of a segment by length.
 * - `extremum` — on a curve, where its tangent turns horizontal or vertical.
 * - `quadrant` — where a closed subpath crosses the horizontal and vertical
 *   lines through the center of its box: a circle's four compass points.
 * - `nearest` — the closest point on any stroke, when nothing else is in range.
 */
export type PathSnapKind =
  | 'anchor' | 'center' | 'intersection' | 'tangent' | 'perpendicular' | 'midpoint' | 'extremum' | 'quadrant'
  | 'nearest';

/** Every snap kind, in the order a picker lists them. */
export const PATH_SNAP_KINDS: readonly PathSnapKind[] = [
  'anchor', 'center', 'intersection', 'tangent', 'perpendicular', 'midpoint', 'extremum', 'quadrant', 'nearest',
];

/** The kinds whose targets stand whatever the probe. */
export type StaticPathSnapKind = 'anchor' | 'center' | 'intersection' | 'midpoint' | 'extremum' | 'quadrant';
const STATIC_KINDS: readonly StaticPathSnapKind[] = ['anchor', 'center', 'intersection', 'midpoint', 'extremum', 'quadrant'];

/** A target the probe landed on. */
export interface PathSnapHit {
  kind: PathSnapKind;
  x: number;
  y: number;
  /** Distance from the probe, in the query's `radius` units. */
  distance: number;
  /** Indices of the paths that make the target: two for a crossing between
   *  paths, one otherwise. */
  paths: readonly number[];
}

/** A query for {@link findPathSnap}. */
export interface PathSnapQuery {
  /** How far from the probe a target may be, in the paths' units times
   *  `scale`. */
  radius: number;
  /** Per-axis scale from the paths' units to the units `radius` is in — a
   *  view's, to measure the radius in screen pixels under any zoom. Default
   *  `{ x: 1, y: 1 }`. */
  scale?: { x: number; y: number };
  /** Kinds to consider. Absent, all of them. */
  kinds?: Iterable<PathSnapKind>;
  /** Where the line being drawn starts. Tangent and perpendicular targets are
   *  measured from it, and there are none without it. */
  origin?: Point;
  /** Paths by index that offer no targets — the ones a drag is moving. */
  skip?: (path: number) => boolean;
}

/** A target that stands whatever the probe: an anchor, a center, a crossing,
 *  a midpoint, an extremum or a quadrant point. */
export interface PathSnapTarget {
  kind: StaticPathSnapKind;
  x: number;
  y: number;
  paths: readonly number[];
}

/** A set of paths, prepared for repeated snapping. Static targets are
 *  computed on first use and kept. */
export interface PathSnapIndex {
  readonly paths: readonly Path[];
  /** Each path's segments. */
  readonly segments: readonly (readonly PathSegment[])[];
  /** The targets that do not depend on the probe, of one kind. */
  targets(kind: StaticPathSnapKind): readonly PathSnapTarget[];
}

/** Prepare `paths` for {@link findPathSnap}. Build one per set of paths and
 *  reuse it while they stand: a crossing search is quadratic in segments.
 *  `extra` adds targets of the caller's own — the center of a box, a point
 *  with no segment at it — each naming the path it belongs to. */
export function createPathSnapIndex(paths: readonly Path[], extra: readonly PathSnapTarget[] = []): PathSnapIndex {
  const segments = paths.map(pathSegments);
  const cache = new Map<string, PathSnapTarget[]>();
  const build = (kind: string): PathSnapTarget[] => {
    const out: PathSnapTarget[] = extra.filter((t) => t.kind === kind);
    if (kind === 'center') return out;
    if (kind === 'anchor') {
      segments.forEach((segs, path) => {
        const seen = new Set<string>();
        for (const s of segs) {
          for (const p of [s.pts[0], s.pts[s.pts.length - 1]]) {
            const key = `${p.x},${p.y}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({ kind: 'anchor', x: p.x, y: p.y, paths: [path] });
          }
        }
      });
      return out;
    }
    if (kind === 'intersection') {
      for (const c of pathCrossings(paths)) {
        out.push({ kind: 'intersection', x: c.x, y: c.y, paths: c.a.path === c.b.path ? [c.a.path] : [c.a.path, c.b.path] });
      }
      return out;
    }
    segments.forEach((segs, path) => {
      if (kind === 'quadrant') {
        for (const p of quadrantPoints(segs)) out.push({ kind: 'quadrant', ...p, paths: [path] });
        return;
      }
      for (const s of segs) {
        const ts = kind === 'midpoint' ? [segmentMidT(s.pts)] : segmentExtremaT(s.pts);
        for (const t of ts) out.push({ kind: kind as StaticPathSnapKind, ...evalSeg(s.pts, t), paths: [path] });
      }
    });
    return out;
  };
  return {
    paths,
    segments,
    targets(kind) {
      let hit = cache.get(kind);
      if (!hit) cache.set(kind, (hit = build(kind)));
      return hit;
    },
  };
}

/** The compass points of each closed subpath in `segs` about the center of its box. */
function quadrantPoints(segs: readonly PathSegment[]): Point[] {
  const out: Point[] = [];
  const subs = new Map<number, PathSegment[]>();
  for (const s of segs) if (s.closed) subs.set(s.sub, [...(subs.get(s.sub) ?? []), s]);
  for (const sub of subs.values()) {
    const x0 = Math.min(...sub.map((s) => s.box.x0)), x1 = Math.max(...sub.map((s) => s.box.x1));
    const y0 = Math.min(...sub.map((s) => s.box.y0)), y1 = Math.max(...sub.map((s) => s.box.y1));
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const across: Seg[] = [[{ x: x0 - 1, y: cy }, { x: x1 + 1, y: cy }], [{ x: cx, y: y0 - 1 }, { x: cx, y: y1 + 1 }]];
    for (const line of across) {
      for (const s of sub) {
        for (const h of intersectSegments(s.pts, line)) {
          if (!out.some((p) => Math.hypot(p.x - h.x, p.y - h.y) < 1e-6)) out.push({ x: h.x, y: h.y });
        }
      }
    }
  }
  return out;
}

function nearestOnSeg(s: Seg, p: Point): { x: number; y: number; dist: number } {
  if (s.length === 2) return nearestOnLine(p.x, p.y, s[0].x, s[0].y, s[1].x, s[1].y);
  if (s.length === 3) return nearestOnQuadratic(p.x, p.y, s[0].x, s[0].y, s[1].x, s[1].y, s[2].x, s[2].y);
  return nearestOnCubic(p.x, p.y, s[0].x, s[0].y, s[1].x, s[1].y, s[2].x, s[2].y, s[3].x, s[3].y);
}

/**
 * The snap target nearest `probe` within `query.radius`, or null when none
 * is in range. Every enabled kind competes on distance, except `nearest`,
 * which answers only when no other target is in range.
 */
export function findPathSnap(index: PathSnapIndex, probe: Point, query: PathSnapQuery): PathSnapHit | null {
  let best: PathSnapHit | null = null;
  for (const hit of findPathSnaps(index, probe, query)) if (!best || hit.distance < best.distance) best = hit;
  return best;
}

/**
 * Every snap target within `query.radius` of `probe`, unsorted. `nearest`
 * hits appear only when no other target is in range. Tangent and perpendicular targets
 * closer to the origin than the radius are dropped, so a line cannot snap
 * back onto its own start.
 */
export function findPathSnaps(index: PathSnapIndex, probe: Point, query: PathSnapQuery): PathSnapHit[] {
  const kinds = new Set(query.kinds ?? PATH_SNAP_KINDS);
  const r = query.radius;
  const sx = Math.abs(query.scale?.x ?? 1), sy = Math.abs(query.scale?.y ?? 1);
  const metric = (dx: number, dy: number) => Math.hypot(dx * sx, dy * sy);
  const skip = query.skip ?? (() => false);
  const hits: PathSnapHit[] = [];
  const offer = (kind: PathSnapKind, x: number, y: number, paths: readonly number[]) => {
    const distance = metric(x - probe.x, y - probe.y);
    if (distance <= r) hits.push({ kind, x, y, distance, paths });
  };

  for (const kind of STATIC_KINDS) {
    if (!kinds.has(kind)) continue;
    for (const t of index.targets(kind)) if (!t.paths.some(skip)) offer(kind, t.x, t.y, t.paths);
  }

  const rx = r / (sx || 1), ry = r / (sy || 1);
  const near = (s: PathSegment) =>
    s.box.x0 - rx <= probe.x && probe.x <= s.box.x1 + rx && s.box.y0 - ry <= probe.y && probe.y <= s.box.y1 + ry;
  const o = query.origin;
  if (o && (kinds.has('tangent') || kinds.has('perpendicular'))) {
    index.segments.forEach((segs, path) => {
      if (skip(path)) return;
      for (const s of segs) {
        if (!near(s)) continue;
        const lists: Array<[PathSnapKind, number[]]> = [];
        if (kinds.has('tangent')) lists.push(['tangent', tangentTsFrom(s.pts, o)]);
        if (kinds.has('perpendicular')) lists.push(['perpendicular', perpendicularTsFrom(s.pts, o)]);
        for (const [kind, ts] of lists) {
          for (const t of ts) {
            const p = evalSeg(s.pts, t);
            if (metric(p.x - o.x, p.y - o.y) > r) offer(kind, p.x, p.y, [path]);
          }
        }
      }
    });
  }

  if (hits.length > 0 || !kinds.has('nearest')) return hits;
  index.segments.forEach((segs, path) => {
    if (skip(path)) return;
    for (const s of segs) {
      if (!near(s)) continue;
      const n = nearestOnSeg(s.pts, probe);
      offer('nearest', n.x, n.y, [path]);
    }
  });
  return hits;
}
