import { cursorFor } from './registry';
import type { CursorGlyphName } from './glyphs';
import { CURSOR_MAX_CSS_PX } from './types';

/**
 * What a tool, action or affordance declares as its cursor.
 *
 * A bare string is a CSS cursor value and passes through untouched, so every
 * declaration written before this type existed keeps working.
 */
export type CursorSpec = string | CursorGlyphSpec;

/** The glyph form of a {@link CursorSpec}. */
export interface CursorGlyphSpec {
  readonly glyph: CursorGlyphName;
  /** Rendered size in CSS px. Default 24. */
  readonly size?: number;
  /**
   * Size in world units instead of `size`, so the glyph tracks zoom — a brush
   * radius ring. Forces the painted tier at every zoom level, because a baked
   * image would have to be rebuilt on every wheel tick.
   */
  readonly worldRadius?: number;
  /** Clockwise rotation in radians, quantized to 22.5° at bake. */
  readonly angle?: number;
  /** Keyword drawn if the browser rejects the image. Default 'default'. */
  readonly fallback?: string;
}

/**
 * Which tier a spec reaches the screen through.
 *
 * Tools never choose this — they declare what they want and the resolver
 * picks, so a brush cursor stays a brush cursor across the radius where it
 * stops being expressible as a CSS cursor at all.
 */
export type ResolvedCursor =
  | { readonly kind: 'css'; readonly css: string }
  | {
      readonly kind: 'painted';
      readonly glyph: CursorGlyphName;
      readonly angle: number;
      /** CSS px, when the spec fixed one. */
      readonly size?: number;
      /** World units; the painter scales this by the live view. */
      readonly worldRadius?: number;
    };

/**
 * Resolve a spec to the tier that can actually draw it.
 *
 * Escalates to painted when the glyph is sized in world units, or when its
 * fixed size is past {@link CURSOR_MAX_CSS_PX} — above which the browser drops
 * the image and silently falls back to the keyword.
 */
export function resolveCursorTier(spec: CursorSpec): ResolvedCursor {
  if (typeof spec === 'string') return { kind: 'css', css: spec };
  const { glyph, size, worldRadius, angle = 0, fallback } = spec;
  if (worldRadius !== undefined) {
    return { kind: 'painted', glyph, angle, worldRadius };
  }
  if (size !== undefined && size > CURSOR_MAX_CSS_PX) {
    return { kind: 'painted', glyph, angle, size };
  }
  return {
    kind: 'css',
    css: cursorFor(glyph, {
      ...(size !== undefined ? { size } : {}),
      ...(fallback !== undefined ? { fallback } : {}),
      angle,
    }),
  };
}

/**
 * A {@link CursorSpec} as a CSS cursor value.
 *
 * Every consumer of a widened cursor field calls this, so a declaration never
 * has to know which form it holds. A painted cursor answers `'none'` — the
 * native cursor gets out of the way and the painted-tier layer draws it. A
 * caller that writes that string without the layer installed leaves the user
 * with no cursor, so reach for {@link resolveCursorTier} if you need to know.
 */
export function resolveCursor(spec: CursorSpec | undefined): string | undefined {
  if (spec === undefined) return undefined;
  const r = resolveCursorTier(spec);
  return r.kind === 'css' ? r.css : 'none';
}
