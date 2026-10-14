import { multiply, scale, translate, type Affine } from '@weasel-js/geom';
import type { FlipAxis } from 'interactions/actions/flip/helpers';
import type { Symmetry } from './types';

/** One copy symmetry makes of what is drawn: the world affine that carries
 *  the drawn half there, and the axis flips it is made of, applied in order. */
export interface SymmetryImage {
  readonly flips: readonly FlipAxis[];
  readonly m: Affine;
}

function about(c: { x: number; y: number }, sx: number, sy: number): Affine {
  return multiply(translate(c.x, c.y), multiply(scale(sx, sy), translate(-c.x, -c.y)));
}

/** Every copy `symmetry` makes, the drawn original excluded: one mirror per
 *  axis, and for both axes the half turn through the center as well. */
export function symmetryImages(symmetry: Symmetry): SymmetryImage[] {
  const c = symmetry.center;
  const x: SymmetryImage = { flips: ['x'], m: about(c, -1, 1) };
  const y: SymmetryImage = { flips: ['y'], m: about(c, 1, -1) };
  if (symmetry.axis === 'vertical') return [x];
  if (symmetry.axis === 'horizontal') return [y];
  return [x, y, { flips: ['x', 'y'], m: about(c, -1, -1) }];
}
