import type { Path } from '@orochi235/weasel';
import type { Mesh } from './mesh';
import { tessellate, type TessellateOptions } from './tessellate';

let cache = new WeakMap<Path, Mesh>();

/**
 * Return the tessellated Mesh for `path`, computing and caching on first call.
 * Cache is keyed on Path identity (WeakMap) — different Path objects with the
 * same coords are distinct cache entries.
 *
 * For step 1, options are passed through to `tessellate` but not used as a
 * cache key (cache is per-Path-identity, not per-options). Consumers that
 * need different tolerances per-frame should construct distinct Path objects.
 */
export function getMesh(path: Path, opts: TessellateOptions = {}): Mesh {
  const cached = cache.get(path);
  if (cached !== undefined) return cached;
  const mesh = tessellate(path, opts);
  cache.set(path, mesh);
  return mesh;
}

/** Test helper. Do not call from product code. */
export function _resetCacheForTests(): void {
  cache = new WeakMap();
}
