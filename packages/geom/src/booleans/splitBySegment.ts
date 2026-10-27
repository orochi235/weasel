import type { Path, PathFillRule } from '../path';
import type { Point } from '../paths/cubicMath';
import { pathUnion } from './ops';
import { type Contour, type Station, evalSeg, signedArea, sideCoeffs, signChanges } from './contourSegments';
import { type Crossing, cutPosition, findCrossings } from './cutCrossings';
import {
  distinctPoints, cutBetween, splitLoops, openClosedCut, interiorLoops, cutOutLoops, polylinesCross,
} from './cutPolyline';
import {
  parseContours, type Subpath, parseSubpaths, contoursIntersect, extentOf, negligibleArea, orientBoundaries,
} from './contours';
import { traceLoops, arcBetween } from './cutLoops';
import { assembleRegions, regionArea, toPath, writePath } from './cutRegions';

export type { Point };

/** Options for `splitPathBySegment` and `splitPathByPolyline`. */
export interface SplitBySegmentOptions {
  /**
   * Flattening tolerance for the check that decides whether contours cross
   * each other. Only a path whose contours do cross is resolved by a union
   * first (see `splitPathByPolyline`).
   */
  flattenTolerance?: number;
}

/**
 * Split `path` along the finite segment a→b into closed pieces (Knife).
 * The same as {@link splitPathByPolyline} with a two-point cut.
 */
export function splitPathBySegment(
  path: Path,
  a: Point,
  b: Point,
  opts: SplitBySegmentOptions = {},
): Path[] | null {
  return splitPathByPolyline(path, [a, b], opts);
}

/**
 * Split `path` along the open polyline `cut` into closed pieces (Knife).
 *
 * Only chords the cut crosses end to end are cut: a stretch of the cut that
 * starts or stops inside the fill cuts nothing, and nothing beyond the cut's
 * ends is touched. Curves are split at the crossing parameters by de Casteljau
 * subdivision, so every piece keeps its quadratic and cubic segments; the new
 * edges follow the cut as straight lines, bends included.
 *
 * A loop the cut draws inside the fill, where it crosses its own track, cuts
 * out the region it encloses: that region is returned as its own piece, with
 * any hole it surrounds, and leaves a hole in the piece around it. A chord
 * running through a loop leaves the loop uncut. A closed cut (its last point
 * equal to its first) is one such loop or, where it crosses the boundary, is
 * cut as the chords it makes. Chords that cross each other are cut one after
 * another.
 *
 * Each connected piece the cut produces is returned as its own path, holes
 * included. Contours the cut misses entirely are returned together as one
 * final piece. A single chord that does not disconnect the shape (across a
 * ring, say) returns one slit piece.
 *
 * A path whose contours cross each other or themselves is first resolved into
 * non-overlapping rings by `pathUnion`, which keeps its curves except in the
 * few cases that union flattens (a cubic that crosses itself, say).
 *
 * Returns `null` when no chord is cut.
 */
export function splitPathByPolyline(
  path: Path,
  cut: readonly Point[],
  opts: SplitBySegmentOptions = {},
): Path[] | null {
  let pts = distinctPoints(cut);
  if (pts.length < 2) return null;
  const outRule = fillRuleOf(path);
  const boundaries = resolveBoundaries(path, opts);
  if (boundaries.length === 0) return null;

  pts = openClosedCut(pts, boundaries);
  const loops = interiorLoops(pts, boundaries);
  const pieces = knife(path, pts, opts, pts.length);
  if (loops.length === 0) return pieces;

  const regions = pieces ? pieces.map((p) => orientBoundaries(parseContours(p), outRule)) : [boundaries];
  if (!cutOutLoops(regions, loops)) return pieces;
  return regions.map((r) => toPath(r, outRule));
}

const fillRuleOf = (path: Path): PathFillRule => (path.kind === 'polygon' ? path.fillRule : 'nonzero');

/** The contours bounding `path`'s fill, fill on their left. Contours that
 *  cross are first resolved by a union. */
function resolveBoundaries(path: Path, opts: SplitBySegmentOptions): Contour[] {
  const contours = parseContours(path);
  if (contoursIntersect(contours, opts.flattenTolerance ?? 0.5)) {
    return orientBoundaries(parseContours(pathUnion(path)), 'nonzero');
  }
  return orientBoundaries(contours, fillRuleOf(path));
}

function knife(path: Path, cut: Point[], opts: SplitBySegmentOptions, budget: number): Path[] | null {
  const outRule = fillRuleOf(path);
  const boundaries = resolveBoundaries(path, opts);
  if (boundaries.length === 0) return null;

  const crossings = findCrossings(boundaries, cut);
  const partner = new Map<Crossing, Crossing>();
  const chord = new Map<Crossing, Point[]>();
  const accepted: Point[][] = [];
  let deferred = false;
  for (let k = 0; k + 1 < crossings.length; k++) {
    const c0 = crossings[k], c1 = crossings[k + 1];
    if (!c0.enters || c1.enters || c1.s - c0.s <= 1e-9) continue;
    const run = splitLoops(cutBetween(cut, c0, c1)).spine;
    if (accepted.some((other) => polylinesCross(run, other))) { deferred = true; continue; }
    accepted.push(run);
    partner.set(c0, c1);
    partner.set(c1, c0);
    chord.set(c0, run);
    chord.set(c1, run.slice().reverse());
  }
  if (partner.size === 0) return null;

  const { loops, untouched } = traceLoops(boundaries, partner, chord);

  const traced = assembleRegions(loops, untouched.filter((c) => signedArea(c) < 0));
  const islands = untouched.filter((c) => signedArea(c) > 0);
  const minArea = negligibleArea(boundaries);
  const regions: Contour[][] = traced.filter((r) => Math.abs(regionArea(r)) > minArea);
  if (islands.length > 0) {
    const leftover = untouched.filter((c) => !traced.some((r) => r.includes(c)));
    regions.push(leftover);
  }
  const pieces: Path[] = regions.map((r) => toPath(r, outRule));
  if (!deferred || budget <= 1) return pieces;
  return pieces.flatMap((p) => knife(p, cut, opts, budget - 1) ?? [p]);
}

/**
 * Split the stroke of `path` wherever the open polyline `cut` crosses it
 * (Scissors).
 *
 * Nothing is closed the way a fill closes it: an open subpath is cut into open
 * runs at each crossing, and a closed one is opened there, so a ring crossed
 * once becomes a single open run that starts and ends at the crossing. Curves
 * are split by de Casteljau subdivision, keeping their segment types. A
 * crossing at an end of an open subpath cuts nothing, and neither does a point
 * where the path only touches the cut.
 *
 * Each run is returned as its own path. Subpaths the cut misses are returned
 * together as one final piece.
 *
 * Returns `null` when nothing is cut.
 */
export function snipPathByPolyline(path: Path, cut: readonly Point[]): Path[] | null {
  const pts = distinctPoints(cut);
  if (pts.length < 2) return null;
  const rule: PathFillRule = path.kind === 'polygon' ? path.fillRule : 'nonzero';

  const runs: Contour[] = [];
  const missed: Subpath[] = [];
  for (const sub of parseSubpaths(path, false)) {
    const stops = snipStations(sub, pts);
    if (stops.length === 0) { missed.push(sub); continue; }
    const segs = sub.segs;
    if (sub.closed) {
      for (let i = 0; i < stops.length; i++) {
        runs.push(arcBetween(segs, stops[i], stops[(i + 1) % stops.length], stops.length === 1));
      }
    } else {
      const last = segs[segs.length - 1];
      const all: Station[] = [
        { seg: 0, t: 0, pt: segs[0][0] },
        ...stops,
        { seg: segs.length - 1, t: 1, pt: last[last.length - 1] },
      ];
      for (let i = 0; i + 1 < all.length; i++) runs.push(arcBetween(segs, all[i], all[i + 1], false));
    }
  }
  if (runs.length === 0) return null;

  const pieces = runs.filter((r) => r.length > 0).map((r) => writePath([{ segs: r, closed: false }], rule));
  if (missed.length > 0) pieces.push(writePath(missed, rule));
  return pieces;
}

/**
 * Where the cut splits one subpath, in order along it. Detections at one point
 * pair off: two there are the path touching the cut and leaving on the side it
 * came from.
 */
function snipStations(sub: Subpath, cut: Point[]): Station[] {
  const raw: Station[] = [];
  sub.segs.forEach((seg, si) => {
    for (let k = 0; k + 1 < cut.length; k++) {
      const a = cut[k];
      const d = { x: cut[k + 1].x - a.x, y: cut[k + 1].y - a.y };
      for (const c of signChanges(sideCoeffs(seg, a, d), true)) {
        const pt = evalSeg(seg, c.t);
        if (cutPosition(cut, k, pt) !== null) raw.push({ seg: si, t: c.t, pt });
      }
    }
  });
  raw.sort((x, y) => x.seg - y.seg || x.t - y.t);

  const tol = extentOf([sub.segs]) * 1e-9;
  const same = (p: Point, q: Point) => Math.abs(p.x - q.x) <= tol && Math.abs(p.y - q.y) <= tol;
  const groups: Station[][] = [];
  for (const st of raw) {
    const g = groups[groups.length - 1];
    if (g && same(g[0].pt, st.pt)) g.push(st); else groups.push([st]);
  }
  if (sub.closed && groups.length > 1 && same(groups[0][0].pt, groups[groups.length - 1][0].pt)) {
    groups[0].push(...groups.pop()!);
  }
  const first = sub.segs[0][0];
  const lastSeg = sub.segs[sub.segs.length - 1];
  const end = lastSeg[lastSeg.length - 1];
  return groups
    .filter((g) => g.length % 2 === 1)
    .map((g) => g[0])
    .filter((st) => sub.closed || (!same(st.pt, first) && !same(st.pt, end)));
}
