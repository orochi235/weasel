import type { GlMat3 } from '@weasel-js/geom';

/**
 * Uniform scale the model matrix applies, as the geometric mean of its two
 * axis lengths, so a non-uniform scale answers with something between the
 * two. Being one glyph-size late or early only changes which of two correct
 * renderings is used.
 */
export function modelScale(m: GlMat3): number {
  const sx = Math.hypot(m[0], m[1]);
  const sy = Math.hypot(m[3], m[4]);
  return Math.sqrt(sx * sy) || 1;
}
