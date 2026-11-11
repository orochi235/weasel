import { describe, expect, it } from 'vitest';
import { bakeCursor, quantizeCursorAngle } from './bake';
import { brushRing } from './brushRing';
import { GLYPHS } from './glyphs';
import { cursorWorldSize } from './paint';
import { cursorFor, cursorGlyph } from './registry';
import { resolveCursorTier } from './resolve';

describe('cursor baking, shrunk', () => {
  it('steps an angle near the double range, which overflowed on the way to its step and baked NaN', () => {
    expect(quantizeCursorAngle(-7.059524432365321e307)).toBeGreaterThanOrEqual(0);
    expect(cursorFor('pen', { mark: 'add', angle: -7.059524432365321e307 })).not.toMatch(/NaN/);
  });

  it('bakes a size of 0 at the default, as a spec of that size resolves, not as an empty image', () => {
    expect(bakeCursor(cursorGlyph('pencil'), { size: 0, angle: 0 })).toBe(bakeCursor(cursorGlyph('pencil')));
    expect(bakeCursor(cursorGlyph('pencil'), { size: -3 })).toBe(bakeCursor(cursorGlyph('pencil')));
  });

  it('draws a brush ring too small to round to a pixel at one, not at the default 24', () => {
    const r = resolveCursorTier(brushRing(0));
    expect(r.kind === 'css' && r.css).toMatch(/width%3D%221%22/);
  });

  it('sizes a world ring finite where the radius on screen is near the double range', () => {
    expect(Number.isFinite(cursorWorldSize(GLYPHS.brush, 1e307, 1))).toBe(true);
  });
});
