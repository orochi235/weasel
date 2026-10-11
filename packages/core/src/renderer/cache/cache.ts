import type { Path } from '@weasel-js/geom';
import { type Mesh, tessellate } from '@weasel-js/geom/tessellate';

let cache = new WeakMap<Path, Mesh>();

/**
 * Return the tessellated Mesh for `path`, computing and caching on first call.
 * Cached by Path identity (WeakMap) — different Path objects with the same
 * coords are distinct cache entries.
 *
 * A rect path the batch stages as a quad never reaches this cache. One used
 * as a clip, or filled with a pattern or vertex colors, does.
 *
 * Also bypassed whenever `DrawContext.flattenTolerance` is set: `fillMeshHandle`
 * (see `../draw`) routes custom-tolerance fills through a fresh transient
 * tessellation instead of this cache.
 */
export function getMesh(path: Path): Mesh {
  const cached = cache.get(path);
  if (cached !== undefined) return cached;
  const mesh = tessellate(path);
  cache.set(path, mesh);
  return mesh;
}

/** Test helper. Do not call from product code. */
export function _resetCacheForTests(): void {
  cache = new WeakMap();
}
