import type { Path } from '@orochi235/weasel';
import type { Mesh } from './mesh';
import { tessellate, type TessellateOptions } from './tessellate';

let cache = new WeakMap<Path, Mesh>();

/**
 * Rect cache keyed by dimensions string. Many demos and animation paths
 * construct fresh Path objects every frame for the same rect dimensions
 * (e.g. tweening x/y of a card); the WeakMap-by-identity cache misses on
 * each one, leading to per-frame GL buffer churn. Keying by dimensions
 * means equivalent rects share the same Mesh object → GLMeshCache hit.
 *
 * Bounded to 1024 entries to prevent unbounded growth on continuous tweens
 * with sub-pixel motion. LRU eviction would be ideal; a simple size cap is
 * a good-enough v1.
 */
const RECT_CACHE_LIMIT = 1024;
let rectCache = new Map<string, Mesh>();

/**
 * Return the tessellated Mesh for `path`, computing and caching on first call.
 * Rect paths are cached by dimensions; polygon paths are cached by Path identity.
 */
export function getMesh(path: Path, opts: TessellateOptions = {}): Mesh {
  if (path.kind === 'rect') {
    const key = `${path.x}_${path.y}_${path.width}_${path.height}`;
    const hit = rectCache.get(key);
    if (hit !== undefined) return hit;
    const mesh = tessellate(path, opts);
    if (rectCache.size >= RECT_CACHE_LIMIT) rectCache.clear();
    rectCache.set(key, mesh);
    return mesh;
  }
  const cached = cache.get(path);
  if (cached !== undefined) return cached;
  const mesh = tessellate(path, opts);
  cache.set(path, mesh);
  return mesh;
}

/** Test helper. Do not call from product code. */
export function _resetCacheForTests(): void {
  cache = new WeakMap();
  rectCache = new Map();
}
