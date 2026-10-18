import { DEFAULT_FLATTEN_TOLERANCE, type GlMat3 } from '@weasel-js/geom';

/**
 * How far a flattened curve may stray from the true one: a length in the
 * path's own units, or `{ px }` on screen, which follows the transform the
 * path draws under.
 */
export type FlattenTolerance = number | { px: number };

/** The default, in device pixels: the world default at scale 1 and dpr 1. */
export const DEFAULT_FLATTEN_TOLERANCE_PX = DEFAULT_FLATTEN_TOLERANCE;

/**
 * `tolerance` in the units of a path drawn under `transform`. A pixel
 * tolerance is measured along the transform's most stretched direction and
 * snapped down to a power of two, so the meshes cached against it survive a
 * zoom until it crosses an octave, and never flatten coarser than asked.
 */
export function worldFlattenTolerance(tolerance: FlattenTolerance | undefined, transform: GlMat3): number {
  if (typeof tolerance === 'number') return tolerance;
  const px = tolerance?.px ?? DEFAULT_FLATTEN_TOLERANCE_PX;
  const [a, b, , c, d] = transform;
  const sum = a * a + b * b + c * c + d * d;
  const det = a * d - b * c;
  const stretch = Math.sqrt((sum + Math.sqrt(Math.max(0, sum * sum - 4 * det * det))) / 2);
  const world = px / stretch;
  if (!(world > 0) || !Number.isFinite(world)) return DEFAULT_FLATTEN_TOLERANCE;
  return 2 ** Math.floor(Math.log2(world));
}

/** `tolerance` with a device-pixel `{ px }` restated in CSS pixels. */
export function inCssPixels(tolerance: FlattenTolerance | undefined, dpr: number): FlattenTolerance {
  if (typeof tolerance === 'number') return tolerance;
  return { px: (tolerance?.px ?? DEFAULT_FLATTEN_TOLERANCE_PX) / dpr };
}
