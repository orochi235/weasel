import type { PatternTransform } from '@weasel-js/paint';
import { mat3, type GlMat3 } from './mat3';

/**
 * Screen → tile-space matrix for a pattern fill: `spaceInverse` takes a screen
 * position into the paint's `units` space, then this undoes the tile's
 * placement there, `origin + transform · tile`. Tile space is in paint units,
 * so the shader divides by the tile's size to get a texture coordinate.
 *
 * `null` when `transform` is singular — a tile collapsed to a line has no
 * point to sample for most of the plane, and a paint with no inverse draws
 * nothing, as gradients do.
 */
export function patternTileSpace(
  spaceInverse: GlMat3,
  origin: { x: number; y: number },
  transform: PatternTransform | undefined,
): GlMat3 | null {
  const [a, b, c, d] = transform ?? [1, 0, 0, 1];
  const placement = mat3.fromAffine([a, b, c, d, origin.x, origin.y]);
  const unplace = mat3.invert(placement);
  return unplace && mat3.multiply(unplace, spaceInverse);
}
