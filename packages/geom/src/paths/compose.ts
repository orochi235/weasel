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

import { boundsOfPath } from './bounds';
import { translatePath } from './transform';
import type { Path } from '../path';

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
  const { x, y } = boundsOfPath(path);
  return { x, y };
}
