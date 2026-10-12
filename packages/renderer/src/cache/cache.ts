import type { Path } from '@weasel-js/geom';
import { type Mesh, tessellate } from '@weasel-js/geom/tessellate';

let cache = new WeakMap<Path, Mesh>();

/**
 * The tessellated Mesh for `path`, cached by Path identity — different Path
 * objects with the same coords are distinct cache entries. Bypassed whenever
 * `DrawContext.flattenTolerance` is set.
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
