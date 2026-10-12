/**
 * Tessellated glyph *outlines' strokes*, in em space: the sibling of
 * `outlineMeshCache`.
 *
 * A stroke's em-space mesh depends on `strokeWidth / fontSize`, so the width is
 * in the key, and a document that animates stroke width or font size will miss
 * every frame. The width is quantized before it reaches the key: neighboring
 * sub-quantum widths would otherwise each get their own entry and evict each
 * other.
 */

import { pathFromD } from '@weasel-js/geom';
import { tessellateStroke } from '@weasel-js/stroke';
import { metricKey, type StrokeMetric } from '@weasel-js/stroke';
import type { Stroke } from '@weasel-js/paint';
import type { Mesh } from '@weasel-js/geom/tessellate';
import { OUTLINE_FLATTEN_TOLERANCE } from './outlineMeshCache';

/** Cached ribbons before the cache is dropped wholesale. */
export const OUTLINE_STROKE_MESH_CACHE_LIMIT = 2048;

/**
 * Em-width quantum: a 0.001 em difference is a fifth of a screen pixel on
 * 200px text, and a slider dragged across a range lands on a bounded set of keys.
 */
const WIDTH_QUANTUM = 1 / 1024;

let cache = new Map<string, Mesh>();

/** Quantized em width, exported so the key builder and the tessellator agree
 *  on the number rather than each rounding for themselves. */
export function quantizeEmWidth(emWidth: number): number {
  return Math.round(emWidth / WIDTH_QUANTUM) * WIDTH_QUANTUM;
}

/**
 * The em-space stroke tessellation of one glyph, or `null` when the ribbon has
 * no area — a zero or negative width, or a glyph whose path is empty (a space).
 *
 * `emWidth` is the stroke width in em, already quantized, and `stroke`'s dashes
 * are in em too. Given a `metric`, the ribbon is built in its space and both
 * are lengths there. `d` is only read on a miss.
 */
export function outlineStrokeMesh(
  glyphKey: string,
  d: string,
  emWidth: number,
  stroke: Stroke,
  metric?: StrokeMetric,
): Mesh | null {
  if (!(emWidth > 0)) return null;
  const key = [
    glyphKey, emWidth, stroke.join ?? 'miter', stroke.cap ?? 'butt',
    stroke.miterLimit ?? '', stroke.align ?? 'center', (stroke.dash ?? []).join(','),
    metricKey(metric),
  ].join('|');

  const cached = cache.get(key);
  if (cached !== undefined) return cached.indices.length === 0 ? null : cached;
  if (cache.size >= OUTLINE_STROKE_MESH_CACHE_LIMIT) cache = new Map();

  const mesh = tessellateStroke(
    pathFromD(d),
    { ...stroke, width: emWidth },
    { flattenTolerance: OUTLINE_FLATTEN_TOLERANCE, metric },
  );
  cache.set(key, mesh);
  return mesh.indices.length === 0 ? null : mesh;
}

/** Test helper. Do not call from product code. */
export function _resetOutlineStrokeMeshCacheForTests(): void {
  cache = new Map();
}
