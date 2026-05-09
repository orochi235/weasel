import type { Path } from '@orochi235/weasel';
import type { Mesh } from './mesh';
import { tessellate, type TessellateOptions } from '../../features/paths/tessellate/tessellate';

let cache = new WeakMap<Path, Mesh>();

/**
 * Return the tessellated Mesh for `path`, computing and caching on first call.
 * Cached by Path identity (WeakMap) — different Path objects with the same
 * coords are distinct cache entries.
 *
 * Note: solid-fill rect paths bypass this cache entirely via `drawRectFast`
 * in `draw.ts`. The cache only serves polygon paths (where tessellation is
 * non-trivial and Path-object stability is the right contract).
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
