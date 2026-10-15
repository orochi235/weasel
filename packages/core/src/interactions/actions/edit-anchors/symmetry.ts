import { anchorSymmetries, type AnchorSet, type AnchorSymmetry } from '@weasel-js/geom';
import type { PathSymmetryDep } from '../depSchema';

/** World-unit slack for "this anchor is the image of that one": enough to
 *  absorb a path's float32 coordinates, far under anything drawn by hand. */
const SYMMETRY_TOLERANCE = 1e-3;

/** The transforms the path `id`, decoded as `set`, is already its own image
 *  under, of those the `pathSymmetry` dep names. Empty without the dep. */
export function editedPathSymmetries(
  dep: PathSymmetryDep | undefined,
  id: string,
  set: AnchorSet,
): AnchorSymmetry[] {
  const transforms = dep?.transforms(id) ?? [];
  return transforms.length === 0 ? [] : anchorSymmetries(set, transforms, SYMMETRY_TOLERANCE);
}
