/**
 * Synthetic bold as geometry. The renderer fakes a missing bold face by
 * dropping the distance-field threshold, which moves every edge of the glyph
 * outward by `syntheticBoldGrowth`; outlining it is the glyph's own outline
 * grown by that distance.
 */

import { syntheticBoldGrowth, type ResolveResult } from '@weasel-js/font';
import { growRegion, type PolygonPath } from '@weasel-js/geom';

/** How closely the grown outline follows the font's curves, in em. */
export const SYNTHETIC_BOLD_TOLERANCE = 0.0005;

const CACHE_LIMIT = 4096;
const cache = new Map<string, PolygonPath>();

/**
 * How far synthetic bold grows a glyph served as `resolved`, in em per side,
 * and how its corners turn; `null` when the renderer draws it unshifted.
 * An MSDF atlas keeps sharp corners, so its shifted edge meets in a miter; a
 * canvas bake is a true distance field, whose shifted edge rounds them.
 */
export function syntheticBoldOffset(resolved: ResolveResult): { growth: number; join: 'miter' | 'round' } | null {
  if (!resolved.synthetic.bold) return null;
  const { source } = resolved;
  if (source !== 'atlas' && source !== 'canvas') return null;
  const { family, weight, style } = resolved.resolved;
  const growth = syntheticBoldGrowth(source, family, weight, style);
  if (growth === undefined || !(growth > 0)) return null;
  return { growth, join: source === 'atlas' ? 'miter' : 'round' };
}

/**
 * `em`, a glyph's em-space outline keyed by its outline data `d`, as the
 * renderer draws it faked bold for `resolved`: unchanged when it is not.
 * The grown contours keep their curves and overlap where they meet, which
 * fills once under `'nonzero'` (`growRegion`).
 */
export function emboldenGlyph(em: PolygonPath, d: string, resolved: ResolveResult): PolygonPath {
  const offset = syntheticBoldOffset(resolved);
  if (offset === null) return em;
  const key = `${offset.growth}|${offset.join}|${d}`;
  let grown = cache.get(key);
  if (grown) return grown;
  grown = growRegion(em, offset.growth, {
    join: offset.join,
    tolerance: SYNTHETIC_BOLD_TOLERANCE,
  });
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(key, grown);
  return grown;
}
