import type { FontStyle } from './fontStyle';
import { getDynamicFace } from './dynamic/dynamicAtlas';
import { getFontFallbackPolicy } from './fallback';
import type { ResolveResult } from './resolveResult';

/**
 * Escalate a *single codepoint* to the dynamic tier when the atlas that
 * resolved for the run has no glyph for it.
 *
 * A baked MSDF atlas covers a fixed charset, so a run it serves can still
 * contain a character it never baked — an em dash, a curly quote. The dynamic
 * tier rasterizes on demand from installed fonts and can serve those.
 *
 * Returns a canvas-tier `ResolveResult` whose `dynamicFace` the caller drives
 * with `requestGlyph(cp)`, or `null` when escalation isn't available: under
 * policy `'none'`, which documents a miss as a *hard* miss, or with no canvas
 * to rasterize into (SSR, a jsdom test without one).
 */
export function resolveCanvasFallback(
  family: string,
  weight: number,
  style: FontStyle,
): ResolveResult | null {
  if (getFontFallbackPolicy() === 'none') return null;
  try {
    return {
      entry: null,
      dynamicFace: getDynamicFace(family, weight, style),
      resolved: { family, weight, style },
      // The dynamic tier rasterizes the real weight and style, so there is
      // nothing for the shader to fake.
      synthetic: { bold: false, italic: false },
      source: 'canvas',
    };
  } catch {
    return null;
  }
}
