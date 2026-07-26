import { describe, it, expect, vi } from 'vitest';
import { parseBmFont, FIXTURE_FONT } from './FontAtlas';
import { layoutGlyphs, quadsToVertexBuffer, buildQuadIndexBuffer } from './GlyphLayout';

const font = parseBmFont(FIXTURE_FONT);
const style = { fontSize: 32, align: 'left' as const, baseline: 'alphabetic' as const };

describe('layoutGlyphs', () => {
  it('emits one quad per known glyph', () => {
    const quads = layoutGlyphs('AB', style, font);
    expect(quads).toHaveLength(2);
  });

  it('advances pen by xadvance + kerning', () => {
    const quads = layoutGlyphs('AB', style, font);
    expect(quads[0].x0).toBeCloseTo(1);
    expect(quads[1].x0).toBeCloseTo(24);
  });

  it('applies fontSize scaling', () => {
    const halfStyle = { ...style, fontSize: 16 };
    const quads = layoutGlyphs('A', halfStyle, font);
    expect(quads[0].x0).toBeCloseTo(0.5);
    expect(quads[0].x1 - quads[0].x0).toBeCloseTo(11);
  });

  it('applies a starting x/y origin offset', () => {
    const quads = layoutGlyphs('A', style, font, { x: 100, y: 200 });
    expect(quads[0].x0).toBeCloseTo(101);
    expect(quads[0].y0).toBeCloseTo(204);
  });

  it('emits UV coordinates normalized to 0..1 atlas space', () => {
    const quads = layoutGlyphs('A', style, font);
    expect(quads[0].u0).toBeCloseTo(0 / 512);
    expect(quads[0].v0).toBeCloseTo(0 / 512);
    expect(quads[0].u1).toBeCloseTo(22 / 512, 4);
    expect(quads[0].v1).toBeCloseTo(28 / 512, 4);
  });

  it('emits a ? fallback quad for unknown codepoints', () => {
    const fontWithQ = parseBmFont({
      ...FIXTURE_FONT,
      chars: [
        ...FIXTURE_FONT.chars,
        { id: 63, x: 48, y: 0, width: 18, height: 28, xoffset: 1, yoffset: 4, xadvance: 18, page: 0 },
      ],
    });
    const quads = layoutGlyphs('Ω', style, fontWithQ);
    expect(quads).toHaveLength(1);
    expect(quads[0].u0).toBeCloseTo(48 / 512, 4);
  });

  it('skips glyphs and warns when codepoint AND fallback are absent', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const quads = layoutGlyphs('Ω', style, font);
    expect(quads).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('937'));
    warnSpy.mockRestore();
  });
});

describe('quadsToVertexBuffer', () => {
  it('produces 16 floats per quad (4 verts × 4 components)', () => {
    const quads = layoutGlyphs('AB', style, font);
    const buf = quadsToVertexBuffer(quads);
    expect(buf.length).toBe(quads.length * 16);
  });

  it('first four values of first quad are x0,y0,u0,v0 of first glyph', () => {
    const quads = layoutGlyphs('A', style, font);
    const buf = quadsToVertexBuffer(quads);
    expect(buf[0]).toBeCloseTo(quads[0].x0);
    expect(buf[1]).toBeCloseTo(quads[0].y0);
    expect(buf[2]).toBeCloseTo(quads[0].u0);
    expect(buf[3]).toBeCloseTo(quads[0].v0);
  });
});

describe('buildQuadIndexBuffer', () => {
  it('produces 6 indices per quad', () => {
    expect(buildQuadIndexBuffer(3).length).toBe(18);
  });

  it('first two triangles of first quad are [0,1,2] and [1,3,2]', () => {
    const idx = buildQuadIndexBuffer(1);
    expect(Array.from(idx)).toEqual([0, 1, 2, 1, 3, 2]);
  });

  it('second quad starts at base vertex 4', () => {
    const idx = buildQuadIndexBuffer(2);
    expect(Array.from(idx.slice(6))).toEqual([4, 5, 6, 5, 7, 6]);
  });
});
