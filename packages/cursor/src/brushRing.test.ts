import { describe, expect, it } from 'vitest';
import { brushRing } from './brushRing';
import { GLYPHS } from './glyphs';
import { resolveCursorTier } from './resolve';

describe('brushRing', () => {
  it("sizes the glyph so its ring, not its box, is `radius` px", () => {
    const spec = brushRing(40);
    if (typeof spec === 'string') throw new Error('expected a glyph spec');
    const ring = GLYPHS.brush.radius!;
    expect(Math.abs(((spec.size! / GLYPHS.brush.box) * ring) - 40)).toBeLessThan(0.5);
  });

  it('measures a world radius in world units, so it paints and follows the zoom', () => {
    expect(brushRing(12, 'world')).toEqual({ glyph: 'brush', worldRadius: 12, fallback: 'crosshair' });
    expect(resolveCursorTier(brushRing(12, 'world'))).toMatchObject({ kind: 'painted', worldRadius: 12 });
  });
});
