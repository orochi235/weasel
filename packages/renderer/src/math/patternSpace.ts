import type { PatternTransform } from '@weasel-js/paint';
import { invert, mat3, type GlMat3 } from '@weasel-js/geom';

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
  // Written out rather than composed through mat3: a batch stages one pattern
  // command per call, and each mat3 step is an allocation.
  const t = transform ?? IDENTITY;
  const u = invert([t[0], t[1], t[2], t[3], origin.x, origin.y]);
  if (!u) return null;
  const s = spaceInverse;
  return mat3.fromAffine([
    u[0] * s[0] + u[2] * s[1],
    u[1] * s[0] + u[3] * s[1],
    u[0] * s[3] + u[2] * s[4],
    u[1] * s[3] + u[3] * s[4],
    u[0] * s[6] + u[2] * s[7] + u[4],
    u[1] * s[6] + u[3] * s[7] + u[5],
  ]);
}

const IDENTITY: PatternTransform = [1, 0, 0, 1];
