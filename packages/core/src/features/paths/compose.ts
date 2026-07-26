/**
 * Translation-only compose/decompose for `Path` poses, the analog of
 * `composeRectPose` / `decomposeRectPose` for the rect-only model. Pair
 * with `composeWorldPose` / `rebaseLocalPose` when an adapter uses `Path`
 * as its `TPose`.
 *
 * Only translation is folded — the kit's hierarchy contract is
 * translation-only, same as for rects. Parent rotation/scale would require
 * a richer compose; that's out of scope here.
 */

import { translatePath } from './transform';
import type { Path } from './types';

/** Express `child` (in `parent`'s local frame) in the next frame up. */
export function composePath(parent: Path, child: Path): Path {
  const origin = pathOrigin(parent);
  return translatePath(child, origin.x, origin.y);
}

/** Inverse of `composePath` — undo `parent`'s translation from a world pose. */
export function decomposePath(parent: Path, world: Path): Path {
  const origin = pathOrigin(parent);
  return translatePath(world, -origin.x, -origin.y);
}

function pathOrigin(path: Path): { x: number; y: number } {
  if (path.kind === 'rect') return { x: path.x, y: path.y };
  // Polygon origin is its AABB top-left, so children compose under the
  // same anchor convention as rects. Cheap walk; if this becomes a hot
  // path we cache bounds on the polygon at build time.
  let minX = Infinity;
  let minY = Infinity;
  const { coords } = path;
  for (let i = 0; i < coords.length; i += 2) {
    if (coords[i] < minX) minX = coords[i];
    if (coords[i + 1] < minY) minY = coords[i + 1];
  }
  if (minX === Infinity) return { x: 0, y: 0 };
  return { x: minX, y: minY };
}
