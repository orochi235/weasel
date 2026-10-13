import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDynamicFace, refreshCanvasFont, resetBakeBudget, PAGE_SIZE,
  _resetDynamicFontsForTests, __setGlyphRasterizerForTests,
} from './dynamicAtlas';
import { colorPageTextureId, syncColorPageTexture, _getColorPagesForTests, _getPagesForTests } from './dynamicPages';
import type { GlyphRasterizer } from './glyphRasterizer';
import type { GlyphTextureSink } from '../textureSink';
import { resolveColorCluster } from '../resolveGlyph';
import { resolveGlyphFallback } from '../registerFont';
import { _resetFallbackForTests, setFontFallbackPolicy } from '../fallback';

const W = 6;
const H = 5;
/** Premultiplied orange at half alpha. */
const TEXEL = [128, 64, 0, 128];

/** Every code point is a solid box; only the thumb has a color glyph. */
function fakeRasterizer(calls: string[] = []): GlyphRasterizer {
  return {
    faceMetrics: () => ({ ascent: 40, descent: 8 }),
    rasterize: () => ({ width: 20, height: 24, alpha: new Uint8ClampedArray(20 * 24).fill(255), left: -8, top: 26, advance: 22 }),
    rasterizeColor: (_family, _weight, _style, text) => {
      calls.push(text);
      if (!text.startsWith('👍')) return null;
      const rgba = new Uint8ClampedArray(W * H * 4);
      for (let i = 0; i < W * H; i++) rgba.set(TEXEL, i * 4);
      return { width: W, height: H, rgba, left: -2, top: 30, advance: 48 };
    },
  };
}

function recordingSink() {
  const calls: { op: string; id: string; rect: number[]; bytes: number }[] = [];
  const ids = new Set<string>();
  const sink: GlyphTextureSink = {
    has: (id) => ids.has(id),
    upload: (id) => id,
    uploadR8: () => {},
    subImageR8: () => {},
    uploadRGBA: (id, w, h, data) => { ids.add(id); calls.push({ op: 'upload', id, rect: [0, 0, w, h], bytes: data.length }); },
    subImageRGBA: (id, x, y, w, h, data) => { calls.push({ op: 'patch', id, rect: [x, y, w, h], bytes: data.length }); },
  };
  return { sink, calls };
}

beforeEach(() => {
  _resetDynamicFontsForTests();
  _resetFallbackForTests();
  __setGlyphRasterizerForTests(fakeRasterizer());
});

describe('a color glyph for a whole cluster', () => {
  it('bakes its premultiplied texels into a color page, and nothing into a field page', () => {
    const char = getDynamicFace('Arial', 400, 'normal').requestCluster('👍🏽')!;
    expect(char).toMatchObject({ color: true, page: 0, width: W, height: H, xadvance: 48, xoffset: -2 });
    const page = _getColorPagesForTests()[0];
    const at = (char.y * PAGE_SIZE + char.x) * 4;
    expect([...page.data.subarray(at, at + 4)]).toEqual(TEXEL);
    const last = ((char.y + H - 1) * PAGE_SIZE + char.x + W - 1) * 4;
    expect([...page.data.subarray(last, last + 4)]).toEqual(TEXEL);
    expect(_getPagesForTests()).toHaveLength(0);
  });

  it('is measured once per cluster, and a cluster with no color glyph stays without one', () => {
    const calls: string[] = [];
    __setGlyphRasterizerForTests(fakeRasterizer(calls));
    const face = getDynamicFace('Arial', 400, 'normal');
    expect(face.requestCluster('👍')).toBe(face.requestCluster('👍'));
    expect(face.requestCluster('🇨🇦')).toBeNull();
    expect(face.requestCluster('🇨🇦')).toBeNull();
    expect(calls).toEqual(['👍', '🇨🇦']);
  });

  it('has none under a rasterizer that draws no color', () => {
    __setGlyphRasterizerForTests({ faceMetrics: () => ({ ascent: 40, descent: 8 }), rasterize: fakeRasterizer().rasterize });
    expect(getDynamicFace('Arial', 400, 'normal').requestCluster('👍')).toBeNull();
  });

  it('waits for a later tick once the frame has spent its bakes', () => {
    resetBakeBudget(0);
    const char = getDynamicFace('Arial', 400, 'normal').requestCluster('👍')!;
    expect(char.page).toBe(-1);
    expect(char.xadvance).toBe(48);
  });

  it('is measured again when its face is', () => {
    const face = getDynamicFace('Arial', 400, 'normal');
    const before = face.requestCluster('👍');
    refreshCanvasFont('Arial');
    expect(face.requestCluster('👍')).not.toBe(before);
  });
});

describe('syncColorPageTexture', () => {
  it('uploads the page whole the first time, then only what was baked since', () => {
    const face = getDynamicFace('Arial', 400, 'normal');
    const { sink, calls } = recordingSink();
    expect(syncColorPageTexture(sink, 0)).toBe(false);
    face.requestCluster('👍');
    expect(syncColorPageTexture(sink, 0)).toBe(true);
    const second = face.requestCluster('👍🏽')!;
    syncColorPageTexture(sink, 0);
    syncColorPageTexture(sink, 0);
    const id = colorPageTextureId(0);
    expect(calls).toEqual([
      { op: 'upload', id, rect: [0, 0, PAGE_SIZE, PAGE_SIZE], bytes: PAGE_SIZE * PAGE_SIZE * 4 },
      { op: 'patch', id, rect: [second.x, second.y, W, H], bytes: W * H * 4 },
    ]);
  });
});

describe('resolveColorCluster', () => {
  const fallback = () => resolveGlyphFallback('Arial', 400, 'normal')!;

  it('serves a cluster with emoji presentation from the canvas tier', () => {
    const hit = resolveColorCluster(fallback(), 'Arial', 400, 'normal', '👍🏽')!;
    expect(hit.glyph).toMatchObject({ color: true });
    expect(hit.advance).toBe(48);
    expect(hit.resolved.source).toBe('canvas');
  });

  it('never asks the rasterizer about a cluster without emoji presentation', () => {
    const calls: string[] = [];
    __setGlyphRasterizerForTests(fakeRasterizer(calls));
    expect(resolveColorCluster(fallback(), 'Arial', 400, 'normal', 'A')).toBeNull();
    expect(calls).toEqual([]);
  });

  it('serves none where a miss is a hard miss', () => {
    const atlasOnly = { ...fallback(), dynamicFace: undefined, source: 'atlas' as const };
    setFontFallbackPolicy('none');
    expect(resolveColorCluster(atlasOnly, 'Arial', 400, 'normal', '👍')).toBeNull();
  });
});
