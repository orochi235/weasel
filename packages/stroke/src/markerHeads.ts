/**
 * A stroke's marker heads as placed geometry, and how far they reach.
 */

import type { MarkerRef, Stroke } from '@weasel-js/paint';
import { type Path, type PolygonPath, boundsOfPath } from '@weasel-js/geom';
import { extractPolylines, type Polyline } from '@weasel-js/geom/tessellate';
import { getMarker, type MarkerEntry } from './strokeMarkers';
import { markerKeyOf, resolveMarkerSize, strokeInsets } from './markerInset';
import { markerSites, type MarkerSite } from './markerSites';
import { strokeFlattening } from './tessellate/flattening';
import { windowTrim } from './trim/windowPolylines';
import {
  coordsOutOfMetric, polylineIntoMetric, type ScreenSpace, type StrokeSpaces,
} from './tessellate/metric';

/** Rotate + translate a marker's geometry onto its site, measured from
 *  `origin`, the stroked path's, as the site is. */
function placed(path: Path, site: MarkerSite, origin: PolygonPath['origin']): PolygonPath {
  const { origin: _own, ...src } = path as PolygonPath;
  const cos = Math.cos(site.angle);
  const sin = Math.sin(site.angle);
  const coords = new Float32Array(src.coords.length);
  for (let i = 0; i < src.coords.length; i += 2) {
    const x = src.coords[i], y = src.coords[i + 1];
    coords[i] = site.x + x * cos - y * sin;
    coords[i + 1] = site.y + x * sin + y * cos;
  }
  return origin ? { ...src, coords, origin } : { ...src, coords };
}

/** One head's placed geometry, before any paint is applied. */
export interface MarkerHead {
  readonly entry: MarkerEntry;
  readonly path: PolygonPath;
  readonly size: number;
  /** Where it was built, when not in world — `size` is in this space's units. */
  readonly space?: ScreenSpace;
}

/**
 * Where one head goes: its shape (`markerShape`) turned by `angle` and moved
 * to `x`, `y` in `space`, then mapped out of that space's metric into the
 * stroked path's coordinates, which are measured from its origin.
 */
export interface MarkerPlacement {
  readonly role: 'start' | 'mid' | 'end';
  readonly entry: MarkerEntry;
  readonly size: number;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly space?: ScreenSpace;
}

/** A head's geometry at its anchor, pointing along +x, before placement. */
export function markerShape(entry: MarkerEntry, size: number, stroke: Stroke): PolygonPath {
  const { origin: _own, ...shape } = entry.path({ size, stroke }) as PolygonPath;
  return shape;
}

/**
 * `placement` as the affine map `[a, b, c, d, tx, ty]` (x' = a·x + c·y + tx)
 * taking its shape into the stroked path's coordinates — what `markerHeads`
 * applies to the shape's points.
 */
export function markerPlacementMap(placement: MarkerPlacement): [number, number, number, number, number, number] {
  const cos = Math.cos(placement.angle), sin = Math.sin(placement.angle);
  const m = placement.space?.metric;
  if (m === undefined) return [cos, sin, -sin, cos, placement.x, placement.y];
  // P⁻¹ = [[r, −q], [−q, p]] after the rotation and the move.
  const out = (x: number, y: number) => [m.r * x - m.q * y, m.p * y - m.q * x];
  const [a, b] = out(cos, sin);
  const [c, d] = out(-sin, cos);
  const [tx, ty] = out(placement.x, placement.y);
  return [a, b, c, d, tx, ty];
}

/**
 * Every marker head for `path` under `stroke`, placed but unpainted.
 * `strokeWidth` is the already width-resolved stroke width; `flattenTolerance`
 * matches what the ribbon used, so heads land on the same flattened vertices
 * the stroke did. A head `spaces` puts in a screen space is placed and sized
 * there and comes back in world units, so it meets the line it caps. Under
 * `stroke.trim` heads sit on the visible runs, windowed as the ribbon is.
 */
export function markerHeads(
  path: Path,
  stroke: Stroke,
  strokeWidth: number,
  flattenTolerance: number | undefined,
  spaces: StrokeSpaces = {},
): MarkerHead[] {
  const origin = path.kind === 'polygon' ? path.origin : undefined;
  return markerPlacements(path, stroke, strokeWidth, flattenTolerance, spaces).map((at) => {
    const head = placed(markerShape(at.entry, at.size, stroke), at, origin);
    if (at.space) coordsOutOfMetric(head.coords, at.space.metric);
    const { entry, size, space } = at;
    return space ? { entry, size, path: head, space } : { entry, size, path: head };
  });
}

/**
 * Where every marker head for `path` under `stroke` goes, as `markerHeads`
 * places them, without building any. `polylines` is the path's flattening
 * (`markerPolylines`), passed by a caller that keeps it across trims.
 */
export function markerPlacements(
  path: Path,
  stroke: Stroke,
  strokeWidth: number,
  flattenTolerance: number | undefined,
  spaces: StrokeSpaces = {},
  polylines: readonly Polyline[] = markerPolylines(path, stroke, strokeWidth, flattenTolerance),
): MarkerPlacement[] {
  const refs = { start: stroke.markerStart, mid: stroke.markerMid, end: stroke.markerEnd };
  if (refs.start === undefined && refs.mid === undefined && refs.end === undefined) return [];

  // Heads sharing a space share one pass over the polyline mapped into it.
  const groups = new Map<ScreenSpace | undefined, { start: boolean; mid: boolean; end: boolean }>();
  for (const role of ['start', 'mid', 'end'] as const) {
    if (refs[role] === undefined) continue;
    const space = spaces[role];
    let want = groups.get(space);
    if (want === undefined) groups.set(space, (want = { start: false, mid: false, end: false }));
    want[role] = true;
  }

  const insets = strokeInsets(stroke, strokeWidth);
  const out: MarkerPlacement[] = [];
  for (const { polyline: pl, fromClosed } of headRuns(path, stroke, polylines)) {
    for (const [space, want] of groups) {
      const inSpace = space ? { ...pl, points: pl.points.slice() } : pl;
      if (space) polylineIntoMetric(inSpace, space.metric);
      for (const site of markerSites(inSpace, want, fromClosed, insets)) {
        const ref: MarkerRef | undefined = refs[site.role];
        if (ref === undefined) continue;
        const entry = getMarker(markerKeyOf(ref));
        if (entry === undefined) continue;
        const size = resolveMarkerSize(ref, strokeWidth);
        const angle = entry.orient === undefined || entry.orient === 'auto' ? site.angle : entry.orient;
        const at = { role: site.role, entry, size, x: site.x, y: site.y, angle };
        out.push(space ? { ...at, space } : at);
      }
    }
  }
  return out;
}

/** The flattening of `path` heads sit on: the corner-resolved path, as the ribbon flattens it. */
export function markerPolylines(
  path: Path, stroke: Stroke, strokeWidth: number, flattenTolerance: number | undefined,
): Polyline[] {
  return extractPolylines(path, strokeFlattening(flattenTolerance, strokeWidth, stroke.vertexWidths));
}

/** The runs heads sit on: `polylines`, windowed as the ribbon is under a trim,
 *  so a head meets the line's end. */
function headRuns(
  path: Path, stroke: Stroke, polylines: readonly Polyline[],
): { polyline: Polyline; fromClosed: boolean }[] {
  if (stroke.trim === undefined) return polylines.map((polyline) => ({ polyline, fromClosed: polyline.closed }));
  return windowTrim(polylines, path, stroke.trim)?.windowed ?? [];
}

/**
 * A key for the stroke fields `entry`'s geometry reads, or `null` when the
 * entry does not say which it reads and only the stroke's identity can stand
 * in for them.
 */
export function markerReadsKey(entry: MarkerEntry, stroke: Stroke): string | null {
  if (entry.reads === undefined) return null;
  let key = '';
  for (const field of entry.reads) key += `${JSON.stringify(stroke[field]) ?? ''}|`;
  return key;
}

/** Distinct stroke readings kept per entry before its map is dropped. */
const READINGS_PER_ENTRY = 64;

/** Each entry's farthest reach from its anchor at `size` 1, outline included,
 *  per value of the fields it reads — or per stroke object, when it does not
 *  say which. */
const REACH_BY_READING = new WeakMap<MarkerEntry, Map<string, number>>();
const REACH_BY_STROKE = new WeakMap<MarkerEntry, WeakMap<Stroke, number>>();

function measureUnitReach(entry: MarkerEntry, stroke: Stroke): number {
  const b = boundsOfPath(entry.path({ size: 1, stroke }));
  // A head turns to its segment's direction, so it reaches as far as its box's farthest corner, whichever way.
  const x = Math.max(Math.abs(b.x), Math.abs(b.x + b.width));
  const y = Math.max(Math.abs(b.y), Math.abs(b.y + b.height));
  return Math.hypot(x, y) + (entry.outline ? entry.outline.width / 2 : 0);
}

function unitReach(entry: MarkerEntry, stroke: Stroke): number {
  const key = markerReadsKey(entry, stroke);
  if (key === null) {
    let byStroke = REACH_BY_STROKE.get(entry);
    if (byStroke === undefined) REACH_BY_STROKE.set(entry, (byStroke = new WeakMap()));
    let reach = byStroke.get(stroke);
    if (reach === undefined) byStroke.set(stroke, (reach = measureUnitReach(entry, stroke)));
    return reach;
  }
  let byReading = REACH_BY_READING.get(entry);
  if (byReading === undefined) REACH_BY_READING.set(entry, (byReading = new Map()));
  let reach = byReading.get(key);
  if (reach === undefined) {
    if (byReading.size >= READINGS_PER_ENTRY) byReading.clear();
    byReading.set(key, (reach = measureUnitReach(entry, stroke)));
  }
  return reach;
}

/**
 * How far `stroke`'s markers can paint from the vertex each sits on, split by
 * where each is built: `world` in world units for a head with a world size,
 * `px` in screen pixels for one with a `{ px }` size. A head with no size
 * takes the stroke width, and with it the width's units. Culling and a path
 * node's grab reach both measure through here.
 */
export function markerReach(stroke: Stroke): { world: number; px: number } {
  const reach = { world: 0, px: 0 };
  const width = stroke.width ?? 1;
  for (const ref of [stroke.markerStart, stroke.markerMid, stroke.markerEnd]) {
    if (ref === undefined) continue;
    const entry = getMarker(markerKeyOf(ref));
    if (entry === undefined) continue;
    const size = typeof ref === 'string' || ref.size === undefined ? width : ref.size;
    const unit = unitReach(entry, stroke);
    if (typeof size === 'number') reach.world = Math.max(reach.world, unit * size);
    else reach.px = Math.max(reach.px, unit * size.px);
  }
  return reach;
}
