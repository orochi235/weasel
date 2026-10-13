import { defaultOpenFill, type Path, type PathOpenFill } from '@weasel-js/geom';
import { type Mesh, tessellate } from '@weasel-js/geom/tessellate';

let cache = new WeakMap<Path, { mesh: Mesh; openFill: PathOpenFill }>();

/**
 * The tessellated Mesh for `path`, cached by Path identity — different Path
 * objects with the same coords are distinct cache entries. A mesh built under
 * another default open-fill rule is rebuilt. Bypassed whenever
 * `DrawContext.flattenTolerance` is set.
 */
export function getMesh(path: Path): Mesh {
  const openFill = defaultOpenFill();
  const cached = cache.get(path);
  if (cached !== undefined && cached.openFill === openFill) return cached.mesh;
  const mesh = tessellate(path);
  cache.set(path, { mesh, openFill });
  return mesh;
}

/** Test helper. Do not call from product code. */
export function _resetCacheForTests(): void {
  cache = new WeakMap();
}
