/**
 * A path measured once by arc length, so many stations along it cost a binary
 * search each rather than a fresh flatten: what `pointAlongPath` answers one
 * fraction at a time, and what anything placing or bending geometry along a
 * path reads many times over.
 */
import type { Path } from '../path';
import { extractPolylines } from '../tessellate/polyline';
import type { Point } from './cubicMath';

/** A point on a path and its heading there. */
export interface PathStation {
  point: Point;
  /** Unit vector along the path at `point`, pointing toward the end. */
  tangent: Point;
}

/** Options for {@link measurePath}. */
export interface MeasurePathOptions {
  /** Curve flattening tolerance, in world units. Default 0.5. */
  flattenTolerance?: number;
}

/** The station on a path nearest a point. */
export interface PathNearestStation extends PathStation {
  /** Arc length at `point`, on the scale {@link PathMeasure.at} reads. */
  s: number;
  /** Distance from the queried point to `point`. */
  dist: number;
}

/** A measured path: its length, and the station at any distance along it. */
export interface PathMeasure {
  /** Total arc length, every subpath counted in order. */
  readonly length: number;
  /** True when the path is a single closed contour, so a distance past the
   *  end can wrap round to the start. */
  readonly closed: boolean;
  /**
   * The station `s` along the path, `s` clamped to `0..length`.
   *
   * The tangent is the heading of the flattened segment under `s`. With
   * `smooth`, it is instead blended across each segment from the heading at
   * one vertex to the next, so geometry bent along it turns without facets.
   */
  at(s: number, smooth?: boolean): PathStation;
  /**
   * The inverse of `at`: the station nearest `p`. On a tie the earliest
   * segment wins. The tangent is the heading of the segment holding it.
   */
  nearest(p: Point): PathNearestStation;
}

interface Segment {
  ax: number; ay: number; bx: number; by: number;
  /** Arc length at the segment's start. */
  start: number;
  len: number;
  /** Unit heading. */
  tx: number; ty: number;
  /** Headings at either end, averaged with the neighbor's, for `smooth`. */
  t0x: number; t0y: number; t1x: number; t1y: number;
}

/**
 * Measure `path` by arc length. Subpaths are measured in order and treated as
 * one run, the way a browser measures a whole `<path>`. Returns `null` for a
 * path with no points; a path of zero length answers at its single point,
 * heading along +X.
 */
export function measurePath(path: Path, opts: MeasurePathOptions = {}): PathMeasure | null {
  const polylines = extractPolylines(
    path,
    opts.flattenTolerance === undefined ? {} : { flattenTolerance: opts.flattenTolerance },
  );
  const segments: Segment[] = [];
  let total = 0;
  let first: Point | undefined;
  let contours = 0;
  let lastClosed = false;
  for (const pl of polylines) {
    const count = pl.points.length / 2;
    if (count === 0) continue;
    contours++;
    lastClosed = pl.closed;
    first ??= { x: pl.points[0]!, y: pl.points[1]! };
    const startIndex = segments.length;
    const last = pl.closed ? count : count - 1;
    for (let i = 0; i < last; i++) {
      const j = (i + 1) % count;
      const ax = pl.points[i * 2]!;
      const ay = pl.points[i * 2 + 1]!;
      const bx = pl.points[j * 2]!;
      const by = pl.points[j * 2 + 1]!;
      const len = Math.hypot(bx - ax, by - ay);
      if (len === 0) continue;
      const tx = (bx - ax) / len;
      const ty = (by - ay) / len;
      segments.push({ ax, ay, bx, by, start: total, len, tx, ty, t0x: tx, t0y: ty, t1x: tx, t1y: ty });
      total += len;
    }
    smoothVertexHeadings(segments, startIndex, pl.closed);
  }
  if (first === undefined) return null;
  const origin = first;
  const closed = contours === 1 && lastClosed;
  if (segments.length === 0) {
    return {
      length: 0,
      closed,
      at: () => ({ point: { ...origin }, tangent: { x: 1, y: 0 } }),
      nearest: (p) => ({
        s: 0,
        dist: Math.hypot(p.x - origin.x, p.y - origin.y),
        point: { ...origin },
        tangent: { x: 1, y: 0 },
      }),
    };
  }

  return {
    length: total,
    closed,
    at(s, smooth = false) {
      const target = Math.min(Math.max(s, 0), total);
      const seg = segments[segmentAt(segments, target)]!;
      const u = Math.min(Math.max((target - seg.start) / seg.len, 0), 1);
      const point = { x: seg.ax + (seg.bx - seg.ax) * u, y: seg.ay + (seg.by - seg.ay) * u };
      if (!smooth) return { point, tangent: { x: seg.tx, y: seg.ty } };
      const x = seg.t0x + (seg.t1x - seg.t0x) * u;
      const y = seg.t0y + (seg.t1y - seg.t0y) * u;
      const l = Math.hypot(x, y);
      return { point, tangent: l === 0 ? { x: seg.tx, y: seg.ty } : { x: x / l, y: y / l } };
    },
    nearest(p) {
      let best = segments[0]!;
      let bestU = 0;
      let bestDist = Infinity;
      for (const seg of segments) {
        const u = Math.min(Math.max(((p.x - seg.ax) * seg.tx + (p.y - seg.ay) * seg.ty) / seg.len, 0), 1);
        const d = Math.hypot(p.x - (seg.ax + (seg.bx - seg.ax) * u), p.y - (seg.ay + (seg.by - seg.ay) * u));
        if (d < bestDist) {
          best = seg;
          bestU = u;
          bestDist = d;
        }
      }
      return {
        s: best.start + best.len * bestU,
        dist: bestDist,
        point: { x: best.ax + (best.bx - best.ax) * bestU, y: best.ay + (best.by - best.ay) * bestU },
        tangent: { x: best.tx, y: best.ty },
      };
    },
  };
}

/** Give each interior vertex of one contour the mean heading of the two
 *  segments meeting there; a closed contour's seam is interior too. */
function smoothVertexHeadings(segments: Segment[], from: number, closed: boolean): void {
  const n = segments.length - from;
  if (n < 2) return;
  const pairs = closed ? n : n - 1;
  for (let k = 0; k < pairs; k++) {
    const a = segments[from + k]!;
    const b = segments[from + ((k + 1) % n)]!;
    let x = a.tx + b.tx;
    let y = a.ty + b.ty;
    const l = Math.hypot(x, y);
    // Two segments doubling back on each other have no mean heading.
    if (l < 1e-9) continue;
    x /= l;
    y /= l;
    a.t1x = x; a.t1y = y;
    b.t0x = x; b.t0y = y;
  }
}

/** Index of the segment covering arc length `s`: binary search on `start`. */
function segmentAt(segments: readonly Segment[], s: number): number {
  let lo = 0;
  let hi = segments.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (segments[mid]!.start <= s) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
