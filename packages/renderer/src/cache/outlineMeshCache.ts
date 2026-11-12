/**
 * Tessellated glyph outlines, in em space. Em space is unit-scale and
 * baseline-relative, so the same glyph of the same face is the same triangles
 * at every size, position, and zoom: tessellate once and pay only a
 * scale-and-translate per occurrence.
 *
 * Flatten tolerance: an error of `T` em shows up as `T × fontSize × viewScale`
 * screen pixels. At 1/4096 em, a glyph would have to reach ~4000 screen pixels
 * tall before the flattening error covered a single pixel.
 *
 * Eviction is wholesale rather than LRU because the refill cost is bounded by
 * what is actually on screen. A key names a glyph by its face's name, which a
 * registration can point at other outlines, so the cache is also dropped
 * whenever `faceGeneration()` moves.
 */

import { faceGeneration } from '@weasel-js/font';
import { pathFromD } from '@weasel-js/geom';
import { tessellate, type Mesh } from '@weasel-js/geom/tessellate';

/** Curve flattening tolerance for glyph outlines, in em. See the header. */
export const OUTLINE_FLATTEN_TOLERANCE = 1 / 4096;

/** Cached glyph tessellations before the cache is dropped wholesale. */
export const OUTLINE_MESH_CACHE_LIMIT = 2048;

let cache = new Map<string, Mesh>();
let faces = faceGeneration();

/**
 * The em-space tessellation of one glyph. `key` identifies the glyph — face
 * identity plus codepoint. `d` is only read on a miss.
 */
export function outlineMesh(key: string, d: string): Mesh {
  if (faces !== faceGeneration()) {
    faces = faceGeneration();
    cache = new Map();
  }
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
