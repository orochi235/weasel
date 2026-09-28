/**
 * A stroke's marker commands, cached per path and stroke. The placed head is a
 * fresh `Path`, and the fill cache keys on path identity — so rebuilding it
 * every frame would re-tessellate and re-upload every head every frame.
 *
 * Keyed on the stroke as the command carried it, before any `{ px }` length
 * was resolved: a marker's geometry may read any field of the stroke, and
 * identity is the only key that covers all of them. The resolved lengths, the
 * flatten tolerance and the registry's generation make up the rest.
 */

import type { Path } from '@weasel-js/core';
import type { MarkerRef, Stroke } from '@weasel-js/paint';
import type { PathDrawCommand } from '../DrawCommand';
import { markerDrawCommands } from 'features/paths/markerCommands';
import { markerGeneration } from '../../core/strokeMarkers';
import { STROKE_CONFIGS_PER_PATH } from './strokeMeshCache';

let cache = new WeakMap<Path, WeakMap<Stroke, Map<string, PathDrawCommand[]>>>();

const refKey = (ref: MarkerRef | undefined): string =>
  ref === undefined ? '' : typeof ref === 'string' ? ref : `${ref.key}@${String(ref.size ?? '')}`;

/**
 * The marker commands for `path` under `stroke`, whose lengths are already
 * resolved to world units. `source` is the stroke before that resolution.
 */
export function cachedMarkerCommands(
  path: Path,
  source: Stroke,
  stroke: Stroke,
  strokeWidth: number,
  flattenTolerance: number | undefined,
): PathDrawCommand[] {
  if (stroke.markerStart === undefined && stroke.markerMid === undefined && stroke.markerEnd === undefined) {
    return [];
  }
  let byStroke = cache.get(path);
  if (byStroke === undefined) {
    byStroke = new WeakMap();
    cache.set(path, byStroke);
  }
  let byKey = byStroke.get(source);
  if (byKey === undefined) {
    byKey = new Map();
    byStroke.set(source, byKey);
  }
  const key = [
    strokeWidth,
    flattenTolerance ?? '',
    markerGeneration(),
    refKey(stroke.markerStart),
    refKey(stroke.markerMid),
    refKey(stroke.markerEnd),
  ].join('|');
  let cmds = byKey.get(key);
  if (cmds === undefined) {
    cmds = markerDrawCommands(path, stroke, strokeWidth, flattenTolerance);
    if (byKey.size >= STROKE_CONFIGS_PER_PATH) byKey.clear();
    byKey.set(key, cmds);
  }
  return cmds;
}

/** Test helper. Do not call from product code. */
export function _resetMarkerCommandCacheForTests(): void {
  cache = new WeakMap();
}
