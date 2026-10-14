import { anchorMirror, type AnchorMirror, type AnchorSet } from '@weasel-js/geom';
import { symmetryImages } from './images';
import type { Symmetry } from './types';

/** World-unit slack for "this anchor is the image of that one": enough to
 *  absorb a path's float32 coordinates, far under anything drawn by hand. */
const MIRROR_TOLERANCE = 1e-3;

/** The copies `symmetry` makes under which `set` is its own image, each with
 *  its anchor pairing. Empty while symmetry is off or the path is lopsided. */
export function anchorMirrors(set: AnchorSet, symmetry: Symmetry | null): AnchorMirror[] {
  if (!symmetry) return [];
  return symmetryImages(symmetry)
    .map((image) => anchorMirror(set, image.m, MIRROR_TOLERANCE))
    .filter((m): m is AnchorMirror => m !== null);
}
