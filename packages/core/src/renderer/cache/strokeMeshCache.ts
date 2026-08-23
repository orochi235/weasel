/**
 * Tessellated stroke ribbons for scene paths, keyed on `Path` identity.
 *
 * The sibling of `cache.ts` (fills) and `outlineStrokeMeshCache.ts` (glyph
 * ribbons in em space), and it inherits their contract: identity, not content.
 * A `Path` rebuilt with equal coords is a distinct entry.
 *
 * Design: `docs/superpowers/specs/2026-08-15-stroke-ribbon-cache-design.md`.
 */

import type { Path, Stroke } from '@weasel-js/core';
import { tessellateStroke, resolveStrokeWidth } from 'features/paths/tessellate/stroke';
import type { Mesh } from './mesh';

/**
 * Distinct stroke configurations kept per path before that path's map is
 * dropped wholesale. A document uses a handful; a width slider passes this on
 * its first drag and then degrades to tessellating every frame, which is what
 * it did before this cache existed.
 */
export const STROKE_CONFIGS_PER_PATH = 8;

interface StrokeEntry {
  readonly mesh: Mesh;
  /** Compared by reference — long enough that stringifying it per frame would
   *  cost what the cache saves. */
  readonly vertexWidths: number[] | undefined;
}

let cache = new WeakMap<Path, Map<string, StrokeEntry>>();

/** The stroke parameters that change the ribbon's geometry. `paint` and
 *  `vertexColors` are absent on purpose: both are applied over the same
 *  triangles at draw time. */
function configKey(stroke: Stroke, flattenTolerance: number | undefined): string {
  return [
    resolveStrokeWidth(stroke.width ?? 1, 1),
    stroke.cap ?? 'butt',
    stroke.join ?? 'miter',
    stroke.miterLimit ?? '',
    stroke.align ?? 'center',
    (stroke.dash ?? []).join(','),
    stroke.varyingWidthJoinThreshold ?? '',
    flattenTolerance ?? '',
  ].join('|');
}

/** The tessellated ribbon for `path` under `stroke`. The same `Mesh` object
 *  comes back for as long as the entry lives. */
export function strokeMesh(
  path: Path,
  stroke: Stroke,
  flattenTolerance: number | undefined,
): Mesh {
  let byConfig = cache.get(path);
  if (byConfig === undefined) {
    byConfig = new Map<string, StrokeEntry>();
    cache.set(path, byConfig);
  }

  const key = configKey(stroke, flattenTolerance);
  const entry = byConfig.get(key);
  if (entry !== undefined && entry.vertexWidths === stroke.vertexWidths) {
    return entry.mesh;
  }

  const mesh = tessellateStroke(path, stroke, { flattenTolerance });
  // Only a new key grows the map; replacing one under a churning
  // `vertexWidths` must not evict the other configurations alongside it.
  if (entry === undefined && byConfig.size >= STROKE_CONFIGS_PER_PATH) byConfig.clear();
  byConfig.set(key, { mesh, vertexWidths: stroke.vertexWidths });
  return mesh;
}

/** Test helper. Do not call from product code. */
export function _resetStrokeMeshCacheForTests(): void {
  cache = new WeakMap();
}
