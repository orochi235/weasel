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
  return { glyph: 'brush', size: Math.round((radius * glyph.box) / ring), fallback: 'crosshair' };
}
