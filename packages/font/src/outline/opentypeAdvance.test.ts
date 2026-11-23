import { describe, expect, it, vi } from 'vitest';
import { createOpenTypeParser } from './opentypeParser';
import { writeFont } from './writtenFont.fixture';

// A glyph whose charstring throws as it parses: opentype.js reads a CFF glyph's advance from its lazily parsed path.
vi.mock('opentype.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('opentype.js')>();
  const ns = (actual as typeof actual & { default?: typeof actual }).default ?? actual;
  const parse: typeof ns.parse = (...args) => {
    const font = ns.parse(...args);
    const get = font.glyphs.get.bind(font.glyphs);
    font.glyphs.get = (index: number) => {
      const glyph = get(index);
      Object.defineProperty(glyph, 'advanceWidth', { get() { throw new TypeError('damaged charstring'); } });
      return glyph;
    };
    return font;
  };
  return { ...actual, parse, default: { ...ns, parse } };
});

describe('a glyph whose advance throws as opentype.js parses it', () => {
  it('reads as unusable from advanceOf, as glyphD for it does, rather than throwing into layout', async () => {
    const face = await createOpenTypeParser()(writeFont({
      family: 'Probe', unitsPerEm: 1000, glyphs: [{ unicodes: [65], advance: 500, contours: [] }],
    }));
    expect(face.advanceOf(65)).toBeNull();
    expect(face.embedding!().advanceOfGlyph(1)).toBe(0);
  });
});
