import { cursorFor } from './registry';
import type { CursorGlyphName } from './glyphs';

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
  /** Clockwise rotation in radians, quantized to 22.5° at bake. */
  readonly angle?: number;
  /** Keyword drawn if the browser rejects the image. Default 'default'. */
  readonly fallback?: string;
}

/**
 * A {@link CursorSpec} as a CSS cursor value.
 *
 * Every consumer of a widened cursor field calls this, so a declaration never
 * has to know which form it holds.
 */
export function resolveCursor(spec: CursorSpec | undefined): string | undefined {
  if (spec === undefined) return undefined;
  if (typeof spec === 'string') return spec;
  const { glyph, ...opts } = spec;
  return cursorFor(glyph, opts);
}
