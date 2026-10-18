import { DEFAULT_FLATTEN_TOLERANCE, defaultOpenFill, type Path, type PathOpenFill } from '@weasel-js/geom';
import { type Mesh, tessellate } from '@weasel-js/geom/tessellate';

/** Tolerances kept per path before its map is dropped wholesale: a zoom
 *  crosses an octave at a time, so a few cover a pan back and forth. */
export const FILL_TOLERANCES_PER_PATH = 4;

let cache = new WeakMap<Path, Map<number, { mesh: Mesh; openFill: PathOpenFill }>>();

/**
 * The tessellated Mesh for `path` at `flattenTolerance`, cached by Path
 * identity and tolerance — different Path objects with the same coords are
 * distinct cache entries. A mesh built under another default open-fill rule
 * is rebuilt.
 */
export function getMesh(path: Path, flattenTolerance = DEFAULT_FLATTEN_TOLERANCE): Mesh {
  const openFill = defaultOpenFill();
  let byTolerance = cache.get(path);
  if (byTolerance === undefined) cache.set(path, (byTolerance = new Map()));
  const cached = byTolerance.get(flattenTolerance);
  if (cached !== undefined && cached.openFill === openFill) return cached.mesh;
  const mesh = tessellate(path, { flattenTolerance });
  if (cached === undefined && byTolerance.size >= FILL_TOLERANCES_PER_PATH) byTolerance.clear();
  byTolerance.set(flattenTolerance, { mesh, openFill });
  return mesh;
}

/** Test helper. Do not call from product code. */
export function _resetCacheForTests(): void {
  cache = new WeakMap();
}
