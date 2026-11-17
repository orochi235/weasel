import { describe, expect, it } from 'vitest';
import { cursorCss, resolveCursor } from './resolve';
import { CURSOR_MAX_CSS_PX } from './types';

describe('cursorCss', () => {
  it('passes a CSS keyword through untouched', () => {
    // Every cursor declaration in the kit predates `CursorSpec`; a widened
    // field that mangled the strings already in it would be a silent break.
    expect(cursorCss('grab')).toBe('grab');
    expect(cursorCss('nwse-resize')).toBe('nwse-resize');
  });

  it('resolves undefined to undefined rather than a default cursor', () => {
    expect(cursorCss(undefined)).toBeUndefined();
  });

  it('bakes a glyph spec', () => {
    expect(cursorCss({ glyph: 'pencil' })).toMatch(/^url\("data:image\/svg\+xml,/);
  });

  it('honours size, angle and fallback', () => {
    expect(cursorCss({ glyph: 'pencil', fallback: 'crosshair' })).toMatch(/, crosshair$/);
    expect(cursorCss({ glyph: 'pencil', size: 32 })).not.toBe(
      cursorCss({ glyph: 'pencil', size: 24 })
    );
    expect(cursorCss({ glyph: 'pencil', angle: Math.PI / 2 })).not.toBe(
      cursorCss({ glyph: 'pencil' })
    );
  });

  it('memoizes, so an object spec costs no more than a string', () => {
    expect(cursorCss({ glyph: 'pencil' })).toBe(cursorCss({ glyph: 'pencil' }));
  });
});

describe('resolveCursor', () => {
  it('reads a non-finite angle as none, for the painted tier as for the baked one', () => {
    expect(resolveCursor({ glyph: 'brush', worldRadius: 4, angle: Number.NaN })).toMatchObject({ angle: 0 });
  });

  it('reports a keyword and a bakeable glyph as CSS', () => {
    expect(resolveCursor('grab')).toEqual({ kind: 'css', css: 'grab' });
    const baked = resolveCursor({ glyph: 'pencil' });
    expect(baked.kind).toBe('css');
  });

  it('escalates past the size the browser silently drops the image at', () => {
    // 128 renders; 129 is dropped with no error anywhere, which is why the
    // boundary is a tier decision and not a runtime surprise.
    expect(resolveCursor({ glyph: 'pencil', size: CURSOR_MAX_CSS_PX }).kind).toBe('css');
    expect(resolveCursor({ glyph: 'pencil', size: CURSOR_MAX_CSS_PX + 1 }).kind).toBe('painted');
  });

  it('escalates a world-sized glyph at any size', () => {
    // Not about how big it is now: a world radius has to track zoom, and a
    // baked image cannot. Even a currently-tiny one is painted.
    const r = resolveCursor({ glyph: 'brush', worldRadius: 0.5 });
    expect(r).toMatchObject({ kind: 'painted', glyph: 'brush', worldRadius: 0.5 });
  });

  it('carries the angle through unquantized to the painter', () => {
    const r = resolveCursor({ glyph: 'brush', worldRadius: 4, angle: 0.3 });
    expect(r).toMatchObject({ kind: 'painted', angle: 0.3 });
  });

  it('hides the native cursor for a painted spec, so the layer is not doubled', () => {
    // The handoff: `cursorCss` still answers with a CSS string, and for a
    // painted cursor that string is `none`. A caller that writes it without
    // installing the layer gets no cursor at all — that is the contract.
    expect(cursorCss({ glyph: 'brush', worldRadius: 4 })).toBe('none');
  });

  it('draws at the default size where the size or world radius is not a positive number', () => {
    const plain = resolveCursor({ glyph: 'pencil' });
    for (const size of [Number.NaN, Infinity, 0, -8]) {
      expect(resolveCursor({ glyph: 'pencil', size })).toEqual(plain);
    }
    for (const worldRadius of [Number.NaN, Infinity, 0, -1]) {
      expect(resolveCursor({ glyph: 'pencil', worldRadius })).toEqual(plain);
    }
  });
});
