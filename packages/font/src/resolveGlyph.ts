/**
 * Finding the glyph for one code point: in the tier a run resolved to, then
 * in the dynamic tier, then nowhere. A miss never draws a stand-in `?`, which
 * is indistinguishable from one the author wrote, and the BmFont atlas format
 * has no `.notdef` to draw.
 */
import type { BmFont, BmFontChar } from './FontAtlas';
import { hasEmojiPresentation } from './emojiCluster';
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
 *  tier has none. With `into`, the answer is written into it and it is
 *  returned: a caller that reads the fields at once and keeps none allocates
 *  nothing a code point. */
export function glyphIn(resolved: ResolveResult, cp: number, into?: ResolvedGlyph): ResolvedGlyph | null {
  const metrics = metricsOf(resolved);
  if (!metrics) return null;
  if (resolved.outlineFace) {
    const advance = metrics.advanceOf(cp);
    return advance === null ? null : answer(into, resolved, metrics, advance, null, null);
  }
  const face = resolved.dynamicFace;
  const font = resolved.entry?.font ?? face?.font;
  const glyph = resolved.entry ? font?.charMap.get(cp) : face?.requestGlyph(cp);
  if (!font || !glyph || (face && !usableGlyph(glyph))) return null;
  return answer(into, resolved, metrics, glyph.xadvance, font, glyph);
}

function answer(
  into: ResolvedGlyph | undefined, resolved: ResolveResult, metrics: GlyphMetrics, advance: number,
  font: BmFont | null, glyph: BmFontChar | null,
): ResolvedGlyph {
  if (!into) return { resolved, metrics, advance, font, glyph };
  into.resolved = resolved; into.metrics = metrics; into.advance = advance; into.font = font; into.glyph = glyph;
  return into;
}

/**
 * The glyph for `cp` in a run that asked for `(family, weight, style)` and
 * resolved to `resolved`: that tier's own, else the dynamic tier's under the
 * face the run asked for. Null when neither has it, with a warning naming the
 * code point unless `warn` is false. `into` is as `glyphIn` takes it.
 */
export function resolveGlyph(
  resolved: ResolveResult,
  family: string,
  weight: number,
  style: FontStyle,
  cp: number,
  warn = true,
  into?: ResolvedGlyph,
): ResolvedGlyph | null {
  const own = glyphIn(resolved, cp, into);
  if (own) return own;
  const fallback = resolveGlyphFallback(family, weight, style);
  const escalated = fallback && glyphIn(fallback, cp, into);
  if (escalated) return escalated;
  if (warn) warnMissingGlyph(resolved.resolved.family, cp);
  return null;
}

/**
 * The color glyph for a whole grapheme cluster with emoji presentation, in a
 * run that asked for `(family, weight, style)` and resolved to `resolved`.
 * The canvas tier is the only one that draws a cluster as one glyph or in its
 * own colors, so it serves these whatever tier serves the run's text. Null for
 * any other cluster, and where the canvas tier is not to be had or draws no
 * color for this one: the cluster is then laid out code point by code point.
 */
export function resolveColorCluster(
  resolved: ResolveResult,
  family: string,
  weight: number,
  style: FontStyle,
  cluster: string,
): ResolvedGlyph | null {
  if (!hasEmojiPresentation(cluster)) return null;
  const tier = resolved.dynamicFace ? resolved : resolveGlyphFallback(family, weight, style);
  const face = tier?.dynamicFace;
  const metrics = tier && metricsOf(tier);
  const glyph = face?.requestCluster(cluster);
  if (!tier || !face || !metrics || !glyph) return null;
  return { resolved: tier, metrics, advance: glyph.xadvance, font: face.font, glyph };
}
