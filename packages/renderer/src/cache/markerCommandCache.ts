/**
 * A stroke's marker heads, cached per path: each head's shape built once,
 * unplaced, and drawn under the transform that places it. A placed head would
 * be a fresh `Path` wherever it moved, and the fill cache keys on path
 * identity, so a trim that animates would re-tessellate and re-upload every
 * head every frame; placing the cached shape is a transform instead.
 *
 * Keyed on value, so a painter that builds a new stroke object every frame
 * still hits: the resolved lengths, the flatten tolerance, the registry's
 * generation, the marker refs and whatever fields each head declares it reads.
 * A head that does not declare them may read any field, so for it the stroke
 * as the command carried it — before any `{ px }` length was resolved — joins
 * the key by identity. The trim is not in the key: it only moves the heads.
 * Paint is applied over the cached geometry, so a new paint reuses the shapes.
 */

import { mat3, type GlMat3, type Path, type PolygonPath } from '@weasel-js/geom';
import type { Polyline } from '@weasel-js/geom/tessellate';
import { strokeTrimKey, type CommandPaint, type MarkerRef, type CommandStroke } from '@weasel-js/paint';
import { shapeDraws, type ShapeDraw } from '../markerCommands';
import {
  markerPlacementMap, markerPlacements, markerPolylines, markerReadsKey, markerShape, type MarkerPlacement,
} from '@weasel-js/stroke';
import { getMarker, markerGeneration } from '@weasel-js/stroke';
import { markerKeyOf } from '@weasel-js/stroke';
import { STROKE_CONFIGS_PER_PATH } from './strokeMeshCache';
import { screenSpaceKey, widestStrokeWidth, type StrokeSpaces } from '@weasel-js/stroke';

type Role = MarkerPlacement['role'];

/** A head as drawn: its shape's draws, under the transform that places it. */
export interface PlacedHead {
  readonly draws: readonly ShapeDraw[];
  /** The shape's coordinates → the stroked command's, its path's origin included. */
  readonly transform: GlMat3;
}

interface Entry {
  readonly polylines: Polyline[];
  readonly shapes: Map<Role, PolygonPath>;
  paint: CommandPaint | undefined;
  draws: Map<Role, ShapeDraw[]>;
  trimKey: string | null;
  placements: { at: MarkerPlacement; transform: GlMat3 }[];
}

let byValue = new WeakMap<Path, Map<string, Entry>>();
let byStroke = new WeakMap<Path, WeakMap<CommandStroke, Map<string, Entry>>>();
let shapesBuilt = 0;

const refKey = (ref: MarkerRef | undefined): string =>
  ref === undefined ? '' : typeof ref === 'string' ? ref : `${ref.key}@${String(ref.size ?? '')}`;

/** What every head of `stroke` reads, or `null` if any head does not say. */
function readsKey(stroke: CommandStroke): string | null {
  let key = '';
  for (const ref of [stroke.markerStart, stroke.markerMid, stroke.markerEnd]) {
    const entry = ref === undefined ? undefined : getMarker(markerKeyOf(ref));
    if (entry === undefined) {
      key += '/';
      continue;
    }
    const reads = markerReadsKey(entry, stroke);
    if (reads === null) return null;
    key += `${reads}/`;
  }
  return key;
}

function mapFor(path: Path, source: CommandStroke, reads: string | null): Map<string, Entry> {
  if (reads !== null) {
    let map = byValue.get(path);
    if (map === undefined) byValue.set(path, (map = new Map()));
    return map;
  }
  let strokes = byStroke.get(path);
  if (strokes === undefined) byStroke.set(path, (strokes = new WeakMap()));
  let map = strokes.get(source);
  if (map === undefined) strokes.set(source, (map = new Map()));
  return map;
}

/**
 * The marker heads for `path` under `stroke`, whose lengths are already
 * resolved. `source` is the stroke before that resolution. A head's lengths are
 * in the space `spaces` builds it in.
 */
export function cachedMarkerHeads(
  path: Path,
  source: CommandStroke,
  stroke: CommandStroke,
  strokeWidth: number,
  flattenTolerance: number | undefined,
  spaces: StrokeSpaces = {},
): PlacedHead[] {
  if (stroke.markerStart === undefined && stroke.markerMid === undefined && stroke.markerEnd === undefined) {
    return [];
  }
  const reads = readsKey(stroke);
  const map = mapFor(path, source, reads);
  const key = [
    strokeWidth,
    // How finely the path is flattened, which is where a head sits on a curve.
    widestStrokeWidth(strokeWidth, stroke.vertexWidths),
    flattenTolerance ?? '',
    markerGeneration(),
    refKey(stroke.markerStart),
    refKey(stroke.markerMid),
    refKey(stroke.markerEnd),
    reads ?? '',
    screenSpaceKey(spaces.start),
    screenSpaceKey(spaces.mid),
    screenSpaceKey(spaces.end),
  ].join('|');
  let entry = map.get(key);
  if (entry === undefined) {
    entry = {
      polylines: markerPolylines(path, stroke, strokeWidth, flattenTolerance),
      shapes: new Map(), paint: stroke.paint, draws: new Map(), trimKey: null, placements: [],
    };
    if (map.size >= STROKE_CONFIGS_PER_PATH) map.clear();
    map.set(key, entry);
  } else if (entry.paint !== stroke.paint) {
    entry.paint = stroke.paint;
    entry.draws = new Map();
  }
  const trimKey = strokeTrimKey(stroke.trim);
  if (entry.trimKey !== trimKey) {
    entry.trimKey = trimKey;
    entry.placements = place(path, stroke, strokeWidth, flattenTolerance, spaces, entry.polylines);
  }
  const out: PlacedHead[] = [];
  for (const { at, transform } of entry.placements) {
    let draws = entry.draws.get(at.role);
    if (draws === undefined) entry.draws.set(at.role, (draws = shapeDraws(at.entry, shapeOf(entry, at, stroke), at.size, stroke)));
    if (draws.length > 0) out.push({ draws, transform });
  }
  return out;
}

function place(
  path: Path, stroke: CommandStroke, strokeWidth: number,
  flattenTolerance: number | undefined, spaces: StrokeSpaces, polylines: Polyline[],
): Entry['placements'] {
  const origin = path.kind === 'polygon' ? path.origin : undefined;
  const out: Entry['placements'] = [];
  for (const at of markerPlacements(path, stroke, strokeWidth, flattenTolerance, spaces, polylines)) {
    const [a, b, c, d, tx, ty] = markerPlacementMap(at);
    out.push({ at, transform: mat3.fromAffine([a, b, c, d, tx + (origin?.x ?? 0), ty + (origin?.y ?? 0)]) });
  }
  return out;
}

function shapeOf(entry: Entry, at: MarkerPlacement, stroke: CommandStroke): PolygonPath {
  let shape = entry.shapes.get(at.role);
  if (shape === undefined) {
    shapesBuilt++;
    entry.shapes.set(at.role, (shape = markerShape(at.entry, at.size, stroke)));
  }
  return shape;
}

/** Test helper: how many head shapes have been built since the last reset. */
export function _markerShapesBuiltForTests(): number {
  return shapesBuilt;
}

/** Test helper. Do not call from product code. */
export function _resetMarkerCommandCacheForTests(): void {
  byValue = new WeakMap();
  byStroke = new WeakMap();
  shapesBuilt = 0;
}
