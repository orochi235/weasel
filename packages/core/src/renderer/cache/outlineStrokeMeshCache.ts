/**
 * Tessellated glyph *outlines' strokes*, in em space.
 *
 * The sibling of `outlineMeshCache`, and cached for the same reason: parsing
 * `d` and tessellating a ribbon costs far more than the per-instance
 * transform that follows, and em space is size- and position-independent, so
 * one tessellation serves every occurrence of that glyph.
 *
 * ### Why the width is in the key
 *
 * A fill mesh is the same triangles at every size. A stroke's is not — the
 * ribbon's width relative to the glyph decides the geometry, so the em-space
 * mesh depends on `strokeWidth / fontSize`. That ratio is a property of the
 * run's style, not of the frame, so it is stable across frames and makes a
 * perfectly good cache key; what it is *not* is free, so a document that
 * animates stroke width or font size will miss every frame. That is the same
 * bargain `tessellate` makes everywhere else, and it is the reason the width
 * is quantized before it reaches the key: neighbouring sub-quantum widths
 * would otherwise each get their own entry and evict each other.
 *
 * Joins, caps, miter limit, alignment and dash all change the ribbon too, so
 * they are in the key as well — assembled by the caller, which already has
 * the `Stroke` in hand.
 */

import { pathFromD } from 'features/paths/pathFromD';
import { tessellateStroke } from 'features/paths/tessellate/stroke';
import type { Stroke } from '@weasel-js/paint';
import type { Mesh } from './mesh';
import { OUTLINE_FLATTEN_TOLERANCE } from './outlineMeshCache';

/** Cached ribbons before the cache is dropped wholesale. Matches the fill
 *  cache's cap: the working set is a charset times the handful of stroke
 *  widths a document actually uses. */
export const OUTLINE_STROKE_MESH_CACHE_LIMIT = 2048;

/**
 * Em-width quantum. 1/1024 em is finer than any width a reader can
 * distinguish at the sizes this tier serves — a 0.001 em difference is a
 * fifth of a screen pixel on 200px text — and coarse enough that a slider
 * dragged across a range lands on a bounded set of keys.
 */
const WIDTH_QUANTUM = 1 / 1024;

let cache = new Map<string, Mesh>();

/** Quantized em width, exported so the key builder and the tessellator agree
 *  on the number rather than each rounding for themselves. */
export function quantizeEmWidth(emWidth: number): number {
  return Math.round(emWidth / WIDTH_QUANTUM) * WIDTH_QUANTUM;
}

/**
 * The em-space stroke tessellation of one glyph.
 *
 * `glyphKey` identifies the glyph (face identity plus codepoint, assembled by
 * `layoutRuns`); `emWidth` is the stroke width divided by the run's font
 * size, already quantized. `d` is only read on a miss.
 *
 * Returns `null` when the ribbon has no area — a zero or negative width, or a
 * glyph whose path is empty (a space).
 */
export function outlineStrokeMesh(
  glyphKey: string,
  d: string,
  emWidth: number,
  stroke: Stroke,
): Mesh | null {
  if (!(emWidth > 0)) return null;
  const key = [
    glyphKey, emWidth, stroke.join ?? 'miter', stroke.cap ?? 'butt',
    stroke.miterLimit ?? '', stroke.align ?? 'center', (stroke.dash ?? []).join(','),
  ].join('|');

  const cached = cache.get(key);
  if (cached !== undefined) return cached.indices.length === 0 ? null : cached;
  if (cache.size >= OUTLINE_STROKE_MESH_CACHE_LIMIT) cache = new Map();

  const mesh = tessellateStroke(
    pathFromD(d),
    { ...stroke, width: emWidth },
    { flattenTolerance: OUTLINE_FLATTEN_TOLERANCE },
  );
  cache.set(key, mesh);
  return mesh.indices.length === 0 ? null : mesh;
}

/** Test helper. Do not call from product code. */
export function _resetOutlineStrokeMeshCacheForTests(): void {
  cache = new Map();
}
