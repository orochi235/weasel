/**
 * Tessellated stroke ribbons for scene paths, keyed on `Path` identity.
 *
 * The sibling of `cache.ts` (fills) and `outlineStrokeMeshCache.ts` (glyph
 * ribbons in em space), and it inherits their contract: identity, not content.
 * A `Path` rebuilt with equal coords is a distinct entry.
 *
 * Design: `docs/superpowers/specs/2026-08-15-stroke-ribbon-cache-design.md`.
 */

import type { Path } from '@weasel-js/core';
import type { Stroke } from '@weasel-js/paint';
import { tessellateStroke, resolveStrokeWidth } from 'features/paths/tessellate/stroke';
import { strokeInsets } from '../../core/markerInset';
import { metricKey, type ScreenSpace, type StrokeSpaces } from 'features/paths/tessellate/metric';
import type { InsetLength } from 'features/paths/tessellate/insets';
import type { Mesh } from '@weasel-js/geom/tessellate';

/**
 * Distinct stroke configurations kept per path before that path's map is
 * dropped wholesale. A document uses a handful; a width slider passes this on
 * its first drag and then degrades to tessellating every frame, which is what
 * it did before this cache existed.
 */
export const STROKE_CONFIGS_PER_PATH = 8;

/** Screen-pixel bound on how far a quantized `{ px }` ribbon's width may
 *  drift from the width asked for: each edge moves at most half of it. */
const PX_WIDTH_TOLERANCE = 1 / 8;

/**
 * `scale` snapped to a log-spaced grid, for resolving a `{ px }` width against.
 * Resolving against the raw scale gives a continuous zoom a new cache key every
 * frame. The grid is fine enough that the resolved ribbon stays within
 * `PX_WIDTH_TOLERANCE` screen pixels of `px`, so it is coarser for thin
 * strokes, and powers of two land on it exactly.
 */
export function quantizeStrokeScale(px: number, scale: number): number {
  if (!(px > 0) || !(scale > 0) || !Number.isFinite(scale)) return scale;
  const stepsPerOctave = Math.ceil(Math.LN2 / (2 * Math.log1p(PX_WIDTH_TOLERANCE / px)));
  return 2 ** (Math.round(Math.log2(scale) * stepsPerOctave) / stepsPerOctave);
}

interface StrokeEntry {
  readonly mesh: Mesh;
  /** Compared by reference — long enough that stringifying it per frame would
   *  cost what the cache saves. */
  readonly vertexWidths: number[] | undefined;
}

let cache = new WeakMap<Path, Map<string, StrokeEntry>>();

/** The stroke parameters that change the ribbon's geometry. `paint` and
 *  `vertexColors` are absent on purpose: both are applied over the same
 *  triangles at draw time. Marker *identity* is absent too — only the
 *  resolved trim distance affects these triangles, so two heads with the
 *  same inset share one entry. */
function configKey(stroke: Stroke, flattenTolerance: number | undefined, spaces: StrokeSpaces): string {
  const width = resolveStrokeWidth(stroke.width ?? 1, 1);
  const insets = strokeInsets(stroke, width);
  const ribbon = spaces.ribbon?.metric;
  return [
    width,
    stroke.cap ?? 'butt',
    stroke.join ?? 'miter',
    stroke.miterLimit ?? '',
    stroke.align ?? 'center',
    (stroke.dash ?? []).join(','),
    stroke.varyingWidthJoinThreshold ?? '',
    flattenTolerance ?? '',
    insets.start,
    insets.end,
    metricKey(ribbon),
    metricKey(spaces.start?.metric),
    metricKey(spaces.end?.metric),
  ].join('|');
}

/** The tessellated ribbon for `path` under `stroke`, built in the space
 *  `spaces` names for it, and stopped short of each head in that head's own.
 *  The same `Mesh` object comes back for as long as the entry lives. */
export function strokeMesh(
  path: Path,
  stroke: Stroke,
  flattenTolerance: number | undefined,
  spaces: StrokeSpaces = {},
): Mesh {
  let byConfig = cache.get(path);
  if (byConfig === undefined) {
    byConfig = new Map<string, StrokeEntry>();
    cache.set(path, byConfig);
  }

  const key = configKey(stroke, flattenTolerance, spaces);
  const entry = byConfig.get(key);
  if (entry !== undefined && entry.vertexWidths === stroke.vertexWidths) {
    return entry.mesh;
  }

  const width = resolveStrokeWidth(stroke.width ?? 1, 1);
  const insets = strokeInsets(stroke, width);
  const mesh = tessellateStroke(path, stroke, {
    flattenTolerance,
    startInset: insetIn(insets.start, spaces.start, spaces.ribbon),
    endInset: insetIn(insets.end, spaces.end, spaces.ribbon),
    metric: spaces.ribbon?.metric,
  });
  // Only a new key grows the map; replacing one under a churning
  // `vertexWidths` must not evict the other configurations alongside it.
  if (entry === undefined && byConfig.size >= STROKE_CONFIGS_PER_PATH) byConfig.clear();
  byConfig.set(key, { mesh, vertexWidths: stroke.vertexWidths });
  return mesh;
}

/** `length`, measured in `head`'s space, as the tessellator reads it. */
function insetIn(length: number, head: ScreenSpace | undefined, ribbon: ScreenSpace | undefined): InsetLength {
  return head?.metric === ribbon?.metric ? length : { length, metric: head?.metric ?? null };
}

/** Test helper. Do not call from product code. */
export function _resetStrokeMeshCacheForTests(): void {
  cache = new WeakMap();
}
