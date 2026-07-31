/**
 * Tessellated glyph outlines, in em space.
 *
 * This is the half of the outline text tier that is expensive: parsing `d`
 * into a path and running earcut over it costs far more than the per-instance
 * transform that follows. It is also the half that does not vary — em space
 * is unit-scale and baseline-relative, so the same glyph of the same face is
 * the same triangles at every size, position and zoom. Tessellate once, keep
 * it, and pay only a scale-and-translate per occurrence.
 *
 * That is why the renderer transforms cached vertices on the CPU and appends
 * them into one shared buffer rather than giving each glyph its own model
 * matrix: a per-glyph matrix would mean a draw call per glyph, throwing away
 * the batching the atlas tier already has, in exchange for saving an
 * arithmetic pass over a few hundred vertices.
 *
 * ### Flatten tolerance
 *
 * Tessellating once means committing to a curve tolerance once, and em space
 * makes that a clean tradeoff rather than a guess: an error of `T` em shows
 * up as `T × fontSize × viewScale` screen pixels. At 1/4096 em, a glyph would
 * have to reach ~4000 screen pixels tall before the flattening error covered
 * a single pixel — well past any size a document is read at, and far enough
 * past the tier's own threshold that the two never interact.
 *
 * ### Bound
 *
 * A plain `Map` with a cap and wholesale eviction. Glyph tessellations are
 * small (a few hundred vertices) and the working set is a charset, not a
 * document — the cap exists so a page that cycles through many faces cannot
 * grow without limit, not because pressure is expected. Wholesale rather than
 * LRU because the refill cost is bounded by what is actually on screen, and
 * an LRU's bookkeeping would cost more than the misses it avoids.
 */

import { pathFromD } from 'features/paths/pathFromD';
import { tessellate } from 'features/paths/tessellate/tessellate';
import type { Mesh } from './mesh';

/** Curve flattening tolerance for glyph outlines, in em. See the header. */
export const OUTLINE_FLATTEN_TOLERANCE = 1 / 4096;

/** Cached glyph tessellations before the cache is dropped wholesale. */
export const OUTLINE_MESH_CACHE_LIMIT = 2048;

let cache = new Map<string, Mesh>();

/**
 * The em-space tessellation of one glyph.
 *
 * `key` identifies the glyph — face identity plus codepoint, assembled by
 * `layoutRuns`. `d` is only read on a miss, so passing the path data on every
 * call costs nothing; it is already in hand from the same source.
 */
export function outlineMesh(key: string, d: string): Mesh {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  if (cache.size >= OUTLINE_MESH_CACHE_LIMIT) cache = new Map();
  const mesh = tessellate(pathFromD(d), { flattenTolerance: OUTLINE_FLATTEN_TOLERANCE });
  cache.set(key, mesh);
  return mesh;
}

/** Test helper. Do not call from product code. */
export function _resetOutlineMeshCacheForTests(): void {
  cache = new Map();
}
