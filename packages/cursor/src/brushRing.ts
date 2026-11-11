import { GLYPHS } from './glyphs';
import type { CursorSpec } from './resolve';
import type { CursorGlyph } from './types';

/** What a brush's radius is measured in: screen px, or world units that follow the zoom. */
export type BrushRingUnit = 'px' | 'world';

/**
 * The `brush` ring cursor drawn `radius` in radius: in CSS px for `'px'`, or in
 * world units for `'world'`, which paints it so it follows the zoom.
 */
export function brushRing(radius: number, unit: BrushRingUnit = 'px'): CursorSpec {
  if (unit === 'world') return { glyph: 'brush', worldRadius: radius, fallback: 'crosshair' };
  const glyph: CursorGlyph = GLYPHS.brush;
  const ring = glyph.radius ?? glyph.box / 2;
  // At least a pixel, so a brush too small to round to one is not drawn at the default size.
  const size = radius >= 0 ? Math.max(1, Math.round((radius * glyph.box) / ring)) : Math.round((radius * glyph.box) / ring);
  return { glyph: 'brush', size, fallback: 'crosshair' };
}
