import { GLYPHS } from './glyphs';
import type { CursorSpec } from './resolve';
import type { CursorGlyph } from './types';

/** What a brush's radius is measured in: screen px, or world units that follow the zoom. */
export type BrushRingUnit = 'px' | 'world';

/**
 * The `brush` ring cursor drawn `radius` in radius: in CSS px for `'px'`, or in
 * world units for `'world'`, which paints it so it follows the zoom. A radius of
 * 0 is a one-pixel ring in either unit. Throws a `RangeError` for an infinite radius, either sign, and for one whose
 * size overflows to infinity, as `bakeCursor` refuses an infinite size, rather than draw it at the default.
 */
export function brushRing(radius: number, unit: BrushRingUnit = 'px'): CursorSpec {
  const refuse = (): never => { throw new RangeError(`brushRing: a radius of ${radius} cannot be drawn`); };
  if (radius === Infinity || radius === -Infinity) refuse();
  if (unit === 'world' && radius !== 0) return { glyph: 'brush', worldRadius: radius, fallback: 'crosshair' };
  const glyph: CursorGlyph = GLYPHS.brush;
  const ring = glyph.radius ?? glyph.box / 2;
  // At least a pixel, so a brush too small to round to one is not drawn at the default size.
  const size = radius >= 0 ? Math.max(1, Math.round((radius * glyph.box) / ring)) : Math.round((radius * glyph.box) / ring);
  if (size === Infinity || size === -Infinity) refuse();
  return { glyph: 'brush', size, fallback: 'crosshair' };
}
