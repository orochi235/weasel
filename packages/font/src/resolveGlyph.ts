/**
 * Finding the glyph for one code point: in the tier a run resolved to, then
 * in the dynamic tier, then nowhere. A miss never draws a stand-in `?`, which
 * is indistinguishable from one the author wrote, and the BmFont atlas format
 * has no `.notdef` to draw.
 */
import type { BmFont, BmFontChar } from './FontAtlas';
import type { FontStyle } from './fontStyle';
import { metricsOf, usableGlyph, type GlyphMetrics } from './glyphMetrics';
import { warnMissingGlyph } from './glyphWarnings';
import { resolveGlyphFallback, type ResolveResult } from './registerFont';

/** A code point's glyph, and the tier that ended up serving it. */
export interface ResolvedGlyph {
  /** The tier serving the glyph. Not the run's own when the code point
   *  escalated to the dynamic tier. */
  resolved: ResolveResult;
  /** That tier's metrics, which are what `advance` is measured in. */
  metrics: GlyphMetrics;
  advance: number;
  /** The atlas to sample and the glyph's record in it. Both null on the
   *  outline tier, which has geometry instead. A canvas glyph's record gains
   *  its atlas rect in place when its bake lands. */
  font: BmFont | null;
  glyph: BmFontChar | null;
}

/** The glyph for `cp` in the tier `resolved` landed on, or null when that
 *  tier has none. */
export function glyphIn(resolved: ResolveResult, cp: number): ResolvedGlyph | null {
  const metrics = metricsOf(resolved);
  if (!metrics) return null;
  if (resolved.outlineFace) {
    const advance = metrics.advanceOf(cp);
    return advance === null ? null : { resolved, metrics, advance, font: null, glyph: null };
  }
  const face = resolved.dynamicFace;
  const font = resolved.entry?.font ?? face?.font;
  const glyph = resolved.entry ? font?.charMap.get(cp) : face?.requestGlyph(cp);
  if (!font || !glyph || (face && !usableGlyph(glyph))) return null;
  return { resolved, metrics, advance: glyph.xadvance, font, glyph };
}

/**
 * The glyph for `cp` in a run that asked for `(family, weight, style)` and
 * resolved to `resolved`: that tier's own, else the dynamic tier's under the
 * face the run asked for. Null when neither has it, with a warning naming the
 * code point unless `warn` is false.
 */
export function resolveGlyph(
  resolved: ResolveResult,
  family: string,
  weight: number,
  style: FontStyle,
  cp: number,
  warn = true,
): ResolvedGlyph | null {
  const own = glyphIn(resolved, cp);
  if (own) return own;
  const fallback = resolveGlyphFallback(family, weight, style);
  const escalated = fallback && glyphIn(fallback, cp);
  if (escalated) return escalated;
  if (warn) warnMissingGlyph(resolved.resolved.family, cp);
  return null;
}
