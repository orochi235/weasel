import { describe, expect, it } from 'vitest';
import { cursorFor } from './registry';
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
  it('throws for a fallback no cursor value holds on every tier', () => {
    expect(() => resolveCursor({ glyph: 'brush', size: 100, fallback: 'a;b' })).toThrow(RangeError);
    expect(() => resolveCursor({ glyph: 'brush', size: 200, fallback: 'a;b' })).toThrow(RangeError);
    expect(() => resolveCursor({ glyph: 'brush', worldRadius: 5, fallback: 'a;b' })).toThrow(RangeError);
  });

  it('paints a glyph that cannot turn upright for an angle inside the first step, as it bakes', () => {
    expect(resolveCursor({ glyph: 'eyedropper', size: 200, angle: 0.15 })).toMatchObject({ kind: 'painted', angle: 0 });
    expect(resolveCursor({ glyph: 'pen', mark: 'add', worldRadius: 4, angle: -0.15 })).toMatchObject({ angle: 0 });
    expect(resolveCursor({ glyph: 'rotate', size: 200, angle: 0.15 })).toMatchObject({ angle: 0.15 });
  });

  it('throws for an infinite size or world radius, as cursorFor does, rather than draw it at 24 px', () => {
    expect(() => cursorFor('pencil', { size: Infinity })).toThrow(RangeError);
    expect(() => resolveCursor({ glyph: 'pencil', size: Infinity })).toThrow(RangeError);
    expect(() => resolveCursor({ glyph: 'brush', worldRadius: Infinity })).toThrow(RangeError);
  });

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

  it('refuses an undrawable glyph or mark on the painted tier as on the baked one', () => {
    for (const spec of [{ worldRadius: 5 }, { size: CURSOR_MAX_CSS_PX + 1 }, {}]) {
      expect(() => resolveCursor({ glyph: 'pencil', mark: 'rect', ...spec })).toThrow(/no slot/);
      expect(() => resolveCursor({ glyph: 'nope' as 'pencil', ...spec })).toThrow(/unknown cursor glyph/);
    }
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
    for (const size of [Number.NaN, -Infinity, 0, -8]) {
      expect(resolveCursor({ glyph: 'pencil', size })).toEqual(plain);
    }
    for (const worldRadius of [Number.NaN, -Infinity, 0, -1]) {
      expect(resolveCursor({ glyph: 'pencil', worldRadius })).toEqual(plain);
    }
  });
});

describe('a turned glyph', () => {
  it('refuses an angle on a glyph that would turn out of its box, on every tier', () => {
    for (const spec of [{ glyph: 'crosshair', mark: 'rect' }, { glyph: 'eyedropper' }] as const) {
      expect(() => resolveCursor({ ...spec, angle: Math.PI / 4 })).toThrow(RangeError);
      expect(() => resolveCursor({ ...spec, angle: Math.PI / 4, worldRadius: 10 })).toThrow(RangeError);
      expect(() => cursorFor(spec.glyph, { ...spec, angle: Math.PI / 4 })).toThrow(RangeError);
      expect(resolveCursor({ ...spec, angle: 0.01 }).kind).toBe('css');
    }
    expect(resolveCursor({ glyph: 'resize', angle: Math.PI / 4 }).kind).toBe('css');
  });
});

