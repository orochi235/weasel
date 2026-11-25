import { describe, expect, it } from 'vitest';
import { brushRing } from './brushRing';
import { GLYPHS } from './glyphs';
import { resolveCursor } from './resolve';

describe('brushRing', () => {
  it("sizes the glyph so its ring, not its box, is `radius` px", () => {
    const spec = brushRing(40);
    if (typeof spec === 'string') throw new Error('expected a glyph spec');
    const ring = GLYPHS.brush.radius!;
    expect(Math.abs(((spec.size! / GLYPHS.brush.box) * ring) - 40)).toBeLessThan(0.5);
  });

  it('measures a world radius in world units, so it paints and follows the zoom', () => {
    expect(brushRing(12, 'world')).toEqual({ glyph: 'brush', worldRadius: 12, fallback: 'crosshair' });
    expect(resolveCursor(brushRing(12, 'world'))).toMatchObject({ kind: 'painted', worldRadius: 12 });
  });

  it('draws a zero world radius as the one-pixel ring a zero px radius is, not at the default size', () => {
    expect(brushRing(0, 'world')).toEqual(brushRing(0, 'px'));
    expect(resolveCursor(brushRing(0, 'world'))).toEqual(resolveCursor(brushRing(0, 'px')));
  });

  it('refuses an infinite radius in either unit rather than drawing it at the default size', () => {
    expect(() => brushRing(Infinity)).toThrow(RangeError);
    expect(() => brushRing(Infinity, 'world')).toThrow(RangeError);
    expect(() => brushRing(-Infinity)).toThrow(RangeError);
    expect(() => brushRing(-Infinity, 'world')).toThrow(RangeError);
  });

  it('refuses a finite radius whose px size overflows to infinity', () => {
    expect(() => brushRing(1e307)).toThrow(RangeError);
    expect(() => brushRing(-1e307)).toThrow(RangeError);
  });
});
