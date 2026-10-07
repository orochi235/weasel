/**
 * A stroke's marker commands, cached per path. The placed head is a fresh
 * `Path`, and the fill cache keys on path identity — so rebuilding it every
 * frame would re-tessellate and re-upload every head every frame.
 *
 * Keyed on value, so a painter that builds a new stroke object every frame
 * still hits: the resolved lengths, the flatten tolerance, the registry's
 * generation, the marker refs and whatever fields each head declares it reads.
 * A head that does not declare them may read any field, so for it the stroke
 * as the command carried it — before any `{ px }` length was resolved — joins
 * the key by identity. Paint is applied over the cached geometry, so a new
 * paint reuses the heads.
 */

import type { Path } from '@weasel-js/core';
import type { FillStyle, MarkerRef, Stroke } from '@weasel-js/paint';
import type { PathDrawCommand } from '../DrawCommand';
import {
  headCommands, markerHeads, markerReadsKey, type MarkerHead,
} from 'features/paths/markerCommands';
import { getMarker, markerGeneration } from '../../core/strokeMarkers';
import { markerKeyOf } from '../../core/markerInset';
import { STROKE_CONFIGS_PER_PATH } from './strokeMeshCache';
import { metricKey, type StrokeMetric } from 'features/paths/tessellate/metric';

interface Entry {
  readonly heads: MarkerHead[];
  paint: FillStyle | undefined;
  cmds: PathDrawCommand[];
}

let byValue = new WeakMap<Path, Map<string, Entry>>();
let byStroke = new WeakMap<Path, WeakMap<Stroke, Map<string, Entry>>>();

const refKey = (ref: MarkerRef | undefined): string =>
  ref === undefined ? '' : typeof ref === 'string' ? ref : `${ref.key}@${String(ref.size ?? '')}`;

/** What every head of `stroke` reads, or `null` if any head does not say. */
function readsKey(stroke: Stroke): string | null {
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

function mapFor(path: Path, source: Stroke, reads: string | null): Map<string, Entry> {
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
 * The marker commands for `path` under `stroke`, whose lengths are already
 * resolved. `source` is the stroke before that resolution. Under the ribbon's
 * `metric` those lengths are in its space, `pxPerUnit` screen pixels apiece.
 */
export function cachedMarkerCommands(
  path: Path,
  source: Stroke,
  stroke: Stroke,
  strokeWidth: number,
  flattenTolerance: number | undefined,
  metric?: StrokeMetric,
  pxPerUnit = 1,
): PathDrawCommand[] {
  if (stroke.markerStart === undefined && stroke.markerMid === undefined && stroke.markerEnd === undefined) {
    return [];
  }
  const reads = readsKey(stroke);
  const map = mapFor(path, source, reads);
  const key = [
    strokeWidth,
    flattenTolerance ?? '',
    markerGeneration(),
    refKey(stroke.markerStart),
    refKey(stroke.markerMid),
    refKey(stroke.markerEnd),
    reads ?? '',
    metricKey(metric),
    metric ? pxPerUnit : '',
  ].join('|');
  let entry = map.get(key);
  if (entry === undefined) {
    const heads = markerHeads(path, stroke, strokeWidth, flattenTolerance, metric);
    entry = { heads, paint: stroke.paint, cmds: commandsFor(heads, stroke, metric, pxPerUnit) };
    if (map.size >= STROKE_CONFIGS_PER_PATH) map.clear();
    map.set(key, entry);
  } else if (entry.paint !== stroke.paint) {
    entry.paint = stroke.paint;
    entry.cmds = commandsFor(entry.heads, stroke, metric, pxPerUnit);
  }
  return entry.cmds;
}

/** A head built in a metric's space is in world units once placed, but its
 *  outline width is still a length in that space — so it goes out as the
 *  screen width it stands for, and is stroked exactly like the line. */
function commandsFor(
  heads: MarkerHead[], stroke: Stroke, metric: StrokeMetric | undefined, pxPerUnit: number,
): PathDrawCommand[] {
  const cmds = headCommands(heads, stroke);
  if (metric === undefined) return cmds;
  return cmds.map((cmd) => {
    const width = cmd.stroke?.width;
    return typeof width === 'number'
      ? { ...cmd, stroke: { ...cmd.stroke, width: { px: width * pxPerUnit } } }
      : cmd;
  });
}

/** Test helper. Do not call from product code. */
export function _resetMarkerCommandCacheForTests(): void {
  byValue = new WeakMap();
  byStroke = new WeakMap();
}
