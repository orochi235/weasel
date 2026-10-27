import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { resolveFontVariant, _resetFontRegistryForTests } from './registerFont';
import { setFontFallbackPolicy, _resetFallbackForTests } from './fallback';
import {
  registerCanvasFont, resetBakeBudget, _resetDynamicFontsForTests, __setGlyphRasterizerForTests,
} from './dynamic/dynamicAtlas';
import { BAKE_SIZE } from './dynamic/glyphRasterizer';
import { glyphOutline, registerFontOutlines, _resetFontOutlinesForTests } from './outline/outlineRegistry';
import { registerTestFont } from './testing/registerTestFont';
import { metricsOf } from './glyphMetrics';
import { glyphIn, resolveGlyph } from './resolveGlyph';

const MISSING = 0xe000;
const MARK = 0x0301;
const JOINER = 0x200d;

beforeEach(() => {
  _resetFontRegistryForTests();
  _resetFallbackForTests();
  _resetDynamicFontsForTests();
  _resetFontOutlinesForTests();
  __setGlyphRasterizerForTests({
    faceMetrics: () => ({ ascent: 40, descent: 8 }),
    rasterize: (_f, _w, _s, cp) => {
      if (cp === MISSING || cp === JOINER) return { width: 0, height: 0, alpha: new Uint8ClampedArray(0), left: 0, top: 0, advance: 0 };
      const advance = cp === MARK ? 0 : 22;
      return { width: 20, height: 24, alpha: new Uint8ClampedArray(20 * 24).fill(255), left: -8, top: 26, advance };
    },
  });
});
afterEach(() => vi.restoreAllMocks());

async function registerOutlineFace(family: string): Promise<void> {
  registerFontOutlines(family, { weight: 400, style: 'normal' }, new ArrayBuffer(4), {
    parser: () => ({
      unitsPerEm: 1000, ascender: 0.8, kernOf: (l: number, r: number) => (l === 65 && r === 66 ? -0.05 : 0),
      advanceOf: (cp: number) => (cp === 65 || cp === 66 ? 0.6 : null),
      glyphD: () => 'M0 0L1 0L1 -1Z',
    }),
  });
  glyphOutline(family, 400, 'normal', 65);
  await new Promise<void>((r) => setTimeout(r, 0));
}

describe('metricsOf', () => {
  it('reads an atlas in its bake-size units', async () => {
    await registerTestFont('inter');
    const resolved = resolveFontVariant('inter', 400, 'normal');
    const m = metricsOf(resolved)!;
    const font = resolved.entry!.font;
    expect(m.size).toBe(font.info.size);
    expect(m.base).toBe(font.common.base);
    expect(m.advanceOf(65)).toBe(font.charMap.get(65)!.xadvance);
    expect(m.advanceOf(MISSING)).toBeNull();
  });

  it('reads a parsed face in ems', async () => {
    await registerOutlineFace('solo');
    const m = metricsOf(resolveFontVariant('solo', 400, 'normal'))!;
    expect([m.size, m.base, m.advanceOf(65), m.advanceOf(67), m.kernOf(65, 66)]).toEqual([1, 0.8, 0.6, null, -0.05]);
  });

  it('measures a canvas face on request', () => {
    registerCanvasFont('Dyn');
    const m = metricsOf(resolveFontVariant('Dyn', 400, 'normal'))!;
    expect(m.size).toBe(BAKE_SIZE);
    expect(m.advanceOf(65)).toBe(22);
    expect(m.advanceOf(MISSING)).toBeNull();
    expect([m.ascent, m.descent]).toEqual([40, 8]);
  });

  it('is one object per face, and none for a miss', async () => {
    await registerTestFont('inter');
    expect(metricsOf(resolveFontVariant('inter', 400, 'normal')))
      .toBe(metricsOf(resolveFontVariant('inter', 400, 'normal')));
    setFontFallbackPolicy('none');
    expect(metricsOf(resolveFontVariant('never-registered', 400, 'normal'))).toBeUndefined();
  });
});

describe('glyphIn', () => {
  it('finds no glyph for a code point a canvas face cannot measure', () => {
    registerCanvasFont('Dyn');
    const resolved = resolveFontVariant('Dyn', 400, 'normal');
    expect(glyphIn(resolved, MISSING)).toBeNull();
    expect(glyphIn(resolved, 65)).toMatchObject({ advance: 22, font: resolved.dynamicFace!.font });
  });

  it('finds a default-ignorable code point a canvas face serves as nothing', () => {
    registerCanvasFont('Dyn');
    expect(glyphIn(resolveFontVariant('Dyn', 400, 'normal'), JOINER)).toMatchObject({ advance: 0 });
  });

  it('finds a zero-advance glyph still waiting for its bake', () => {
    registerCanvasFont('Dyn');
    resetBakeBudget(0);
    const hit = glyphIn(resolveFontVariant('Dyn', 400, 'normal'), MARK);
    expect(hit).not.toBeNull();
    expect(hit!.glyph!.page).toBe(-1);
  });

  it('has geometry and no atlas record on the outline tier', async () => {
    await registerOutlineFace('solo');
    const resolved = resolveFontVariant('solo', 400, 'normal');
    expect(glyphIn(resolved, 65)).toMatchObject({ advance: 0.6, font: null, glyph: null });
    expect(glyphIn(resolved, 67)).toBeNull();
  });
});

describe('resolveGlyph', () => {
  it('escalates a code point the atlas lacks to the dynamic tier', async () => {
    await registerTestFont('inter');
    const resolved = resolveFontVariant('inter', 400, 'normal');
    expect(resolveGlyph(resolved, 'inter', 400, 'normal', 65)!.resolved).toBe(resolved);
    expect(resolveGlyph(resolved, 'inter', 400, 'normal', 0x2014)!.resolved.source).toBe('canvas');
  });

  it('does not warn for a default-ignorable code point the dynamic tier serves as nothing', async () => {
    await registerTestFont('inter');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const resolved = resolveFontVariant('inter', 400, 'normal');
    expect(resolveGlyph(resolved, 'inter', 400, 'normal', JOINER)!.resolved.source).toBe('canvas');
    expect(resolveGlyph(resolved, 'inter', 400, 'normal', MISSING)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('U+E000');
  });

  it('warns once per code point for a miss, and not at all when told not to', async () => {
    await registerTestFont('inter');
    setFontFallbackPolicy('none');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const resolved = resolveFontVariant('inter', 400, 'normal');

    expect(resolveGlyph(resolved, 'inter', 400, 'normal', 0x2015, false)).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    expect(resolveGlyph(resolved, 'inter', 400, 'normal', 0x2014)).toBeNull();
    resolveGlyph(resolved, 'inter', 400, 'normal', 0x2014);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('U+2014');
  });
});

describe('glyphIn and resolveGlyph into a given object', () => {
  it('write the answer into it and return it, and leave it be on a miss', async () => {
    await registerTestFont('inter');
    const resolved = resolveFontVariant('inter', 400, 'normal');
    const into = { resolved, metrics: metricsOf(resolved)!, advance: -1, font: null, glyph: null };
    const fresh = glyphIn(resolved, 65)!;
    expect(glyphIn(resolved, 65, into)).toBe(into);
    expect(into).toEqual(fresh);
    expect(resolveGlyph(resolved, 'inter', 400, 'normal', 66, true, into)).toBe(into);
    expect(into.glyph).toBe(resolved.entry!.font.charMap.get(66));
    into.advance = -1;
    expect(glyphIn(resolved, MISSING, into)).toBeNull();
    expect(into.advance).toBe(-1);
  });
});
