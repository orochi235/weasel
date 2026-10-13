import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  GLYPH_MODE_MSDF, GLYPH_MODE_R8, registerFont, FIXTURE_FONT, registerCanvasFont,
  setFontFallbackPolicy, setDefaultFontFamily, getFontFallbackPolicy,
} from '@weasel-js/font';
import {
  _resetFontRegistryForTests, _resetDynamicFontsForTests, __setGlyphRasterizerForTests,
} from '@weasel-js/font/test-seams';
import type { DrawCommand } from './DrawCommand';
import { dispatch, flushBatch } from './draw';
import { FLOATS_PER_VERTEX } from './drawBatch';
import { createRecorderCtx, stagedVertices, paintModes } from './testing/recorderCtx';

describe('drawText — canvas-dynamic routing', () => {
  beforeEach(() => {
    _resetDynamicFontsForTests();
    __setGlyphRasterizerForTests({
      faceMetrics: () => ({ ascent: 40, descent: 8 }),
      rasterize: () => ({
        width: 20, height: 24, alpha: new Uint8ClampedArray(20 * 24).fill(255),
        left: -8, top: 26, advance: 22,
      }),
    });
    registerCanvasFont('Dyn');
  });

  it('paints a canvas group in the single-channel mode, off the dynamic page', () => {
    const { ctx, calls } = createRecorderCtx();
    const cmd: DrawCommand = {
      kind: 'text',
      x: 10, y: 10,
      runs: [{
        text: 'A', fontFamily: 'Dyn', fontWeight: 400, fontStyle: 'normal',
        fontSize: 24, fill: { paint: { kind: 'solid', color: '#000' } },
      }],
      maxWidth: Infinity, align: 'left', style: {},
    } as DrawCommand;
    dispatch(ctx, cmd);
    expect(paintModes(ctx, calls)).toContain(GLYPH_MODE_R8);
    expect(paintModes(ctx, calls)).not.toContain(GLYPH_MODE_MSDF);
    // Full page upload happened (texImage2D — the recorder can't see the R8 format args).
    expect(calls.some((c) => c.name === 'texImage2D')).toBe(true);
  });
});

/**
 * The 'substitute' fallback policy is only real if the substitute atlas
 * actually reaches the GPU. A correct `ResolveResult.substituted` proves
 * nothing here — these assert uploads and draw calls.
 */
describe('drawText — substituted family reaches the GPU', () => {
  let priorPolicy: ReturnType<typeof getFontFallbackPolicy>;

  beforeEach(async () => {
    priorPolicy = getFontFallbackPolicy();
    _resetFontRegistryForTests();
    _resetDynamicFontsForTests();
    const encoder = new TextEncoder();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('.json')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_FONT) });
      }
      return Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })),
      });
    }) as typeof fetch;
    global.createImageBitmap = vi.fn().mockResolvedValue({
      width: 512, height: 512, close: vi.fn(),
    } as unknown as ImageBitmap);
    await registerFont('inter', { weight: 400, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    setFontFallbackPolicy('substitute');
    setDefaultFontFamily('inter');
  });

  afterEach(() => {
    setFontFallbackPolicy(priorPolicy);
  });

  const ghostText = (): DrawCommand => ({
    kind: 'text', x: 0, y: 0,
    runs: [{
      text: 'A', fontFamily: 'ghost', fontSize: 16, fontWeight: 400,
      fontStyle: 'normal', fill: { paint: { kind: 'solid', color: '#000' } },
      letterSpacing: 0,
      underline: false, strikethrough: false, overline: false, baselineShift: 0,
    }],
    maxWidth: Infinity, align: 'left', style: {},
  });

  it('uploads an atlas texture for text in an unregistered family', () => {
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, ghostText());
    expect(calls.some((c) => c.name === 'texImage2D')).toBe(true);
  });

  it('draws quads for text in an unregistered family', () => {
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, ghostText());
    // 1 glyph → 4 corners, and the substituted atlas is what it samples.
    expect(stagedVertices(ctx, calls)).toHaveLength(4 * FLOATS_PER_VERTEX);
    expect(paintModes(ctx, calls)).toEqual(new Set([GLYPH_MODE_MSDF]));
    expect(calls.filter((c) => c.name === 'drawElements')).toHaveLength(1);
  });

  it('renders nothing for an unregistered family under the "none" policy', () => {
    setFontFallbackPolicy('none');
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, ghostText());
    expect(calls.some((c) => c.name === 'drawElements')).toBe(false);
    expect(calls.some((c) => c.name === 'texImage2D')).toBe(false);
  });

  it('still draws a registered family through the exact-match path', () => {
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, {
      kind: 'text', x: 0, y: 0,
      runs: [{
        text: 'A', fontFamily: 'inter', fontSize: 16, fontWeight: 400,
        fontStyle: 'normal', fill: { paint: { kind: 'solid', color: '#000' } },
        letterSpacing: 0,
        underline: false, strikethrough: false, overline: false, baselineShift: 0,
      }],
      maxWidth: Infinity, align: 'left', style: {},
    });
    expect(calls.some((c) => c.name === 'texImage2D')).toBe(true);
    flushBatch(ctx);
    expect(calls.filter((c) => c.name === 'drawElements')).toHaveLength(1);
  });
});
