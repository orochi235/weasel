import { describe, expect, it } from 'vitest';
import { resolveCursor, resolveCursorTier } from './resolve';
import { CURSOR_MAX_CSS_PX } from './types';

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

describe('resolveCursorTier', () => {
  it('reports a keyword and a bakeable glyph as CSS', () => {
    expect(resolveCursorTier('grab')).toEqual({ kind: 'css', css: 'grab' });
    const baked = resolveCursorTier({ glyph: 'pencil' });
    expect(baked.kind).toBe('css');
  });

  it('escalates past the size the browser silently drops the image at', () => {
    // 128 renders; 129 is dropped with no error anywhere, which is why the
    // boundary is a tier decision and not a runtime surprise.
    expect(resolveCursorTier({ glyph: 'pencil', size: CURSOR_MAX_CSS_PX }).kind).toBe('css');
    expect(resolveCursorTier({ glyph: 'pencil', size: CURSOR_MAX_CSS_PX + 1 }).kind).toBe('painted');
  });

  it('escalates a world-sized glyph at any size', () => {
    // Not about how big it is now: a world radius has to track zoom, and a
    // baked image cannot. Even a currently-tiny one is painted.
    const r = resolveCursorTier({ glyph: 'brush', worldRadius: 0.5 });
    expect(r).toMatchObject({ kind: 'painted', glyph: 'brush', worldRadius: 0.5 });
  });

  it('carries the angle through unquantized to the painter', () => {
    const r = resolveCursorTier({ glyph: 'brush', worldRadius: 4, angle: 0.3 });
    expect(r).toMatchObject({ kind: 'painted', angle: 0.3 });
  });

  it('hides the native cursor for a painted spec, so the layer is not doubled', () => {
    // The handoff: `resolveCursor` still answers with a CSS string, and for a
    // painted cursor that string is `none`. A caller that writes it without
    // installing the layer gets no cursor at all — that is the contract.
    expect(resolveCursor({ glyph: 'brush', worldRadius: 4 })).toBe('none');
  });
});
