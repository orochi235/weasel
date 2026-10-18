import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getDynamicFace, refreshCanvasFont, resetBakeBudget, PAGE_SIZE,
  _resetDynamicFontsForTests, __setGlyphRasterizerForTests,
} from './dynamicAtlas';
import { _getColorPagesForTests, _getSharpColorPagesForTests } from './dynamicPages';
import { sharperColorGlyph, MAX_SHARP_LEVEL } from './sharpColor';
import { BAKE_SIZE, type GlyphRasterizer } from './glyphRasterizer';

/** A color glyph whose box scales with the size it is drawn at: 0.5em
 *  square plus a 2px pad, hung 2px left of the pen and 0.6em above the
 *  baseline. */
function fakeRasterizer(sizes: number[] = []): GlyphRasterizer {
  return {
    faceMetrics: () => ({ ascent: 40, descent: 8 }),
    rasterize: () => ({ width: 20, height: 24, alpha: new Uint8ClampedArray(20 * 24).fill(255), left: -8, top: 26, advance: 22 }),
    rasterizeColor: (_family, _weight, _style, text, size = BAKE_SIZE) => {
      sizes.push(size);
      if (!text.startsWith('👍')) return null;
      const side = size / 2 + 4;
      return {
        width: side, height: side, rgba: new Uint8ClampedArray(side * side * 4).fill(200),
        left: -2, top: size * 0.6, advance: size,
      };
    },
  };
}

beforeEach(() => {
  vi.useRealTimers();
  _resetDynamicFontsForTests();
  __setGlyphRasterizerForTests(fakeRasterizer());
});

const thumb = () => getDynamicFace('Arial', 400, 'normal').requestCluster('👍')!;

describe('sharperColorGlyph', () => {
  it('has nothing sharper for a glyph drawn at or below its bake size', () => {
    expect(sharperColorGlyph(thumb(), 1)).toBeNull();
    expect(sharperColorGlyph(thumb(), 0.3)).toBeNull();
  });

  it('bakes the cluster again at the power of two above the size it is drawn at', () => {
    const sizes: number[] = [];
    __setGlyphRasterizerForTests(fakeRasterizer(sizes));
    const char = thumb();
    const sharp = sharperColorGlyph(char, 3)!;
    expect(sizes).toEqual([BAKE_SIZE, BAKE_SIZE * 4]);
    expect(sharp.level).toBe(2);
    const side = BAKE_SIZE * 2 + 4;
    expect(sharp.glyph).toMatchObject({ color: true, width: side, height: side, page: 0 });
    // Placed in the base bake's frame, in its texels: the same pen, a quarter the size.
    expect(sharp.glyph.xoffset).toBeCloseTo(-2 / 4);
    expect(sharp.glyph.yoffset).toBeCloseTo(char.yoffset);
    expect(_getSharpColorPagesForTests()).toHaveLength(1);
    expect(_getColorPagesForTests()).toHaveLength(1);
  });

  it('bakes each level once', () => {
    const sizes: number[] = [];
    __setGlyphRasterizerForTests(fakeRasterizer(sizes));
    const char = thumb();
    expect(sharperColorGlyph(char, 3)).toBe(sharperColorGlyph(char, 4));
    expect(sizes).toHaveLength(2);
  });

  it('stops at its largest level however far it is magnified', () => {
    expect(sharperColorGlyph(thumb(), 1000)!.level).toBe(MAX_SHARP_LEVEL);
  });

  it('serves the sharpest level already baked while a sharper one waits for its tick', async () => {
    vi.useFakeTimers();
    const char = thumb();
    const two = sharperColorGlyph(char, 2)!;
    resetBakeBudget(0);
    expect(sharperColorGlyph(char, 8)).toBe(two);
    await vi.runAllTimersAsync();
    expect(sharperColorGlyph(char, 8)!.level).toBe(3);
  });

  it('serves nothing sharper until any level has baked', () => {
    resetBakeBudget(1);
    const char = thumb();
    expect(sharperColorGlyph(char, 4)).toBeNull();
  });

  it('empties only its own pages when they fill, and the glyph keeps its base bake', async () => {
    vi.useFakeTimers();
    const face = getDynamicFace('Arial', 400, 'normal');
    // 196px squares: five to a 1024px row, twenty-five to a page.
    const clusters = Array.from({ length: 101 }, (_, i) => `👍${String.fromCodePoint(0xfe00 + (i % 16))}${'‍'.repeat(i)}`);
    resetBakeBudget(Infinity);
    for (const text of clusters) sharperColorGlyph(face.requestCluster(text)!, 8);
    const first = face.requestCluster(clusters[0])!;
    await vi.runAllTimersAsync();
    expect(first.page).toBe(0);
    expect(face.requestCluster(clusters[0])).toBe(first);
    expect(sharperColorGlyph(first, 8)?.level).toBe(3);
  });

  it('forgets its sharper bakes when the face is measured again', () => {
    const sizes: number[] = [];
    __setGlyphRasterizerForTests(fakeRasterizer(sizes));
    const before = thumb();
    sharperColorGlyph(before, 4);
    refreshCanvasFont('Arial');
    const after = thumb();
    expect(after).not.toBe(before);
    expect(sharperColorGlyph(after, 4)).not.toBeNull();
    expect(sizes).toEqual([BAKE_SIZE, BAKE_SIZE * 4, BAKE_SIZE, BAKE_SIZE * 4]);
  });
});

describe('a sharper bake on its page', () => {
  it('holds the texels the rasterizer drew', () => {
    const sharp = sharperColorGlyph(thumb(), 2)!;
    const page = _getSharpColorPagesForTests()[0];
    const at = (sharp.glyph.y * PAGE_SIZE + sharp.glyph.x) * 4;
    expect([...page.data.subarray(at, at + 4)]).toEqual([200, 200, 200, 200]);
  });
});
