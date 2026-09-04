import { describe, expect, it } from 'vitest';
import { cursorFor } from './registry';

describe('cursorFor', () => {
  it('returns a bakeable cursor string for a known glyph', () => {
    expect(cursorFor('pencil')).toMatch(/^url\("data:image\/svg\+xml,/);
  });

  it('memoizes on name and options', () => {
    // The hover pump calls this on every idle pointermove; an unmemoized bake
    // would build a fresh data URI per pointer event.
    expect(cursorFor('pencil', { size: 24 })).toBe(cursorFor('pencil', { size: 24 }));
  });

  it('does not collide across sizes', () => {
    expect(cursorFor('pencil', { size: 24 })).not.toBe(cursorFor('pencil', { size: 32 }));
  });

  it('does not collide across fallbacks', () => {
    expect(cursorFor('pencil', { fallback: 'crosshair' })).not.toBe(
      cursorFor('pencil', { fallback: 'default' }),
    );
  });

  it('throws on an unknown glyph name rather than yielding an empty cursor', () => {
    // @ts-expect-error — exercising the runtime guard behind the type.
    expect(() => cursorFor('trowel')).toThrow(/trowel/);
  });
});

describe('cursorFor rotation', () => {
  it('does not collide across angles', () => {
    expect(cursorFor('pencil', { angle: 0 })).not.toBe(
      cursorFor('pencil', { angle: Math.PI / 2 }),
    );
  });

  it('shares one entry across angles inside a step', () => {
    // The hover pump feeds a continuously varying selection rotation. Keying
    // on the raw angle would mint an entry per pointer event and never hit.
    expect(cursorFor('pencil', { angle: 0.01 })).toBe(cursorFor('pencil', { angle: 0 }));
    expect(cursorFor('pencil', { angle: Math.PI * 2 })).toBe(cursorFor('pencil', { angle: 0 }));
  });
});
