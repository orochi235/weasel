import { anchorSymmetries, type AnchorSet, type AnchorSymmetry } from '@weasel-js/geom';
import type { PathSymmetryDep } from '@weasel-js/core';

/** World-unit slack for "this anchor is the image of that one" near the origin, far under anything drawn by hand. */
const SYMMETRY_TOLERANCE = 1e-3;

/** A few float32 steps at `set`'s largest coordinate: how far apart a point and its image can be stored. */
function toleranceFor(set: AnchorSet): number {
  let m = 0;
  for (const sub of set.anchors) {
    for (const a of sub) {
      m = Math.max(m, Math.abs(a.x), Math.abs(a.y));
      if (a.inHandle) m = Math.max(m, Math.abs(a.inHandle.x), Math.abs(a.inHandle.y));
      if (a.outHandle) m = Math.max(m, Math.abs(a.outHandle.x), Math.abs(a.outHandle.y));
    }
  }
  return Math.max(SYMMETRY_TOLERANCE, m * 2 ** -21);
}

/** The transforms the path `id`, decoded as `set`, is already its own image
 *  under, of those the `pathSymmetry` dep names. Empty without the dep. */
export function editedPathSymmetries(
  dep: PathSymmetryDep | undefined,
  id: string,
  set: AnchorSet,
): AnchorSymmetry[] {
  const transforms = dep?.transforms(id) ?? [];
  return transforms.length === 0 ? [] : anchorSymmetries(set, transforms, toleranceFor(set));
}
