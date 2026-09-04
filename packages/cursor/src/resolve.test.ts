import { describe, expect, it } from 'vitest';
import { resolveCursor } from './resolve';

describe('resolveCursor', () => {
  it('passes a CSS keyword through untouched', () => {
    // Every cursor declaration in the kit predates `CursorSpec`; a widened
    // field that mangled the strings already in it would be a silent break.
    expect(resolveCursor('grab')).toBe('grab');
    expect(resolveCursor('nwse-resize')).toBe('nwse-resize');
  });

  it('resolves undefined to undefined rather than a default cursor', () => {
    expect(resolveCursor(undefined)).toBeUndefined();
  });

  it('bakes a glyph spec', () => {
    expect(resolveCursor({ glyph: 'pencil' })).toMatch(/^url\("data:image\/svg\+xml,/);
  });

  it('honours size, angle and fallback', () => {
    expect(resolveCursor({ glyph: 'pencil', fallback: 'crosshair' })).toMatch(/, crosshair$/);
    expect(resolveCursor({ glyph: 'pencil', size: 32 })).not.toBe(
      resolveCursor({ glyph: 'pencil', size: 24 })
    );
    expect(resolveCursor({ glyph: 'pencil', angle: Math.PI / 2 })).not.toBe(
      resolveCursor({ glyph: 'pencil' })
    );
  });

  it('memoizes, so an object spec costs no more than a string', () => {
    expect(resolveCursor({ glyph: 'pencil' })).toBe(resolveCursor({ glyph: 'pencil' }));
  });
});
