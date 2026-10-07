/**
 * Turning a stroke's markers into draw commands.
 *
 * Separate `PathDrawCommand`s rather than triangles appended to the stroke
 * ribbon: an entry may carry a fill and an outline at once, or a paint that
 * differs from the line's, neither of which one mesh can express — and folding
 * them in would drag the whole marker vocabulary into the ribbon cache key.
 */

import type { MarkerRef, Stroke } from '@weasel-js/paint';
import { type Path, type PolygonPath, boundsOfPath } from '@weasel-js/geom';
import type { PathDrawCommand } from '../../renderer/DrawCommand';
import { getMarker, type MarkerEntry, type MarkerPaint } from '../../core/strokeMarkers';
import { markerKeyOf, resolveMarkerSize } from '../../core/markerInset';
import { extractPolylines } from '@weasel-js/geom/tessellate';
import { markerSites, type MarkerSite } from './markerSites';
import {
  coordsOutOfMetric, polylineIntoMetric, type ScreenSpace, type StrokeSpaces,
} from './tessellate/metric';

/** Rotate + translate a marker's geometry onto its site. */
function placed(path: Path, site: MarkerSite): PolygonPath {
  const src = path as PolygonPath;
  const cos = Math.cos(site.angle);
  const sin = Math.sin(site.angle);
  const coords = new Float32Array(src.coords.length);
  for (let i = 0; i < src.coords.length; i += 2) {
    const x = src.coords[i], y = src.coords[i + 1];
    coords[i] = site.x + x * cos - y * sin;
    coords[i + 1] = site.y + x * sin + y * cos;
  }
  return { kind: 'polygon', commands: src.commands, coords, fillRule: src.fillRule };
}

function resolvePaint(p: MarkerPaint | undefined, stroke: Stroke, fallback: MarkerPaint) {
  const v = p ?? fallback;
  if (v === 'none') return undefined;
  return v === 'line' ? stroke.paint : v;
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
 * Every marker head for `path` under `stroke`, placed but unpainted.
 * `strokeWidth` is the already width-resolved stroke width; `flattenTolerance`
 * matches what the ribbon used, so heads land on the same flattened vertices
 * the stroke did. A head `spaces` puts in a screen space is placed and sized
 * there and comes back in world units, so it meets the line it caps.
 */
export function markerHeads(
  path: Path,
  stroke: Stroke,
  strokeWidth: number,
  flattenTolerance: number | undefined,
  spaces: StrokeSpaces = {},
): MarkerHead[] {
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

  const out: MarkerHead[] = [];
  for (const pl of extractPolylines(path, { flattenTolerance })) {
    for (const [space, want] of groups) {
      const inSpace = space ? { ...pl, points: pl.points.slice() } : pl;
      if (space) polylineIntoMetric(inSpace, space.metric);
      for (const site of markerSites(inSpace, want)) {
        const ref: MarkerRef | undefined = refs[site.role];
        if (ref === undefined) continue;
        const entry = getMarker(markerKeyOf(ref));
        if (entry === undefined) continue;
        const size = resolveMarkerSize(ref, strokeWidth);
        const angle = entry.orient === undefined || entry.orient === 'auto' ? site.angle : entry.orient;
        const head = placed(entry.path({ size, stroke }), { ...site, angle });
        if (space) coordsOutOfMetric(head.coords, space.metric);
        out.push(space ? { entry, size, path: head, space } : { entry, size, path: head });
      }
    }
  }
  return out;
}

/** `heads` as draw commands in `stroke`'s paint. A head whose fill and outline
 *  both resolve to no paint is dropped. */
export function headCommands(heads: readonly MarkerHead[], stroke: Stroke): PathDrawCommand[] {
  const out: PathDrawCommand[] = [];
  for (const { entry, path, size, space } of heads) {
    const fill = resolvePaint(entry.fill, stroke, 'line');
    // A head built in a screen space is in world once placed, but its outline
    // width is still in that space's units — so it goes out as the screen
    // width it stands for, and is stroked as exactly as the line.
    const width = entry.outline ? entry.outline.width * size : 0;
    const outline = entry.outline
      ? { paint: resolvePaint(entry.outline.paint, stroke, 'line'), width: space ? { px: width * space.pxPerUnit } : width }
      : null;
    if (fill === undefined && (outline === null || outline.paint === undefined)) continue;
    out.push({
      kind: 'path',
      path,
      ...(fill ? { fill } : {}),
      ...(outline && outline.paint
        ? { stroke: { paint: outline.paint, width: outline.width, cap: 'round', join: 'round' } }
        : {}),
    });
  }
  return out;
}

/** Every marker command for `path` under `stroke`; see {@link markerHeads}. */
export function markerDrawCommands(
  path: Path,
  stroke: Stroke,
  strokeWidth: number,
  flattenTolerance: number | undefined,
): PathDrawCommand[] {
  return headCommands(markerHeads(path, stroke, strokeWidth, flattenTolerance), stroke);
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
  return Math.max(Math.abs(b.x), Math.abs(b.x + b.width), Math.abs(b.y), Math.abs(b.y + b.height))
    + (entry.outline ? entry.outline.width / 2 : 0);
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
