import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerFont, FIXTURE_FONT, GLYPH_MODE_MSDF, colorPageTextureId, resetBakeBudget } from '@weasel-js/font';
import {
  _resetFontRegistryForTests, _resetDynamicFontsForTests, _resetFallbackForTests, __setGlyphRasterizerForTests,
} from '@weasel-js/font/test-seams';
import { _resetLayoutCacheForTests } from '@weasel-js/text/test-seams';
import { dispatch } from './draw';
import { FLOATS_PER_VERTEX, TEX_SLOT_OFFSET } from './drawBatch';
import { PAINT_MODE_IMAGE, paintModeOf } from './shaders/batchFill';
import { createRecorderCtx, stagedVertices } from './testing/recorderCtx';

const SIDE = 60;

/** What the staged vertices in `mode` carry: color, uv, and the alpha that rides after the color matrix. */
function verticesOf(verts: Float32Array, mode: number) {
  const out: { rgba: number[]; uv: number[]; post: number }[] = [];
  for (let i = 0; i < verts.length; i += FLOATS_PER_VERTEX) {
    if (paintModeOf(verts[i + TEX_SLOT_OFFSET]) !== mode) continue;
    out.push({ rgba: [...verts.subarray(i + 2, i + 6)], uv: [...verts.subarray(i + 6, i + 8)], post: verts[i + 8] });
  }
  return out;
}

function textCommand(text: string, color: string) {
  return {
    kind: 'text' as const, x: 0, y: 0,
    runs: [{
      text, fontFamily: 'inter', fontSize: 32, fontWeight: 400, fontStyle: 'normal' as const,
      fill: { paint: { kind: 'solid' as const, color } }, letterSpacing: 0,
      underline: false, strikethrough: false, overline: false, baselineShift: 0,
    }],
    maxWidth: Infinity, align: 'left' as const, style: {},
  };
}

beforeEach(async () => {
  const encoder = new TextEncoder();
  global.fetch = vi.fn().mockImplementation((url: string) => (url.endsWith('.json')
    ? Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_FONT) })
    : Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })) })
  )) as typeof fetch;
  global.createImageBitmap = vi.fn().mockResolvedValue({ width: 512, height: 512, close: vi.fn() } as unknown as ImageBitmap);
  _resetFontRegistryForTests();
  _resetDynamicFontsForTests();
  _resetFallbackForTests();
  _resetLayoutCacheForTests();
  resetBakeBudget();
  __setGlyphRasterizerForTests({
    faceMetrics: () => ({ ascent: 40, descent: 8 }),
    rasterize: () => ({ width: 20, height: 24, alpha: new Uint8ClampedArray(20 * 24).fill(255), left: -8, top: 26, advance: 22 }),
    rasterizeColor: () => ({ width: SIDE, height: SIDE, rgba: new Uint8ClampedArray(SIDE * SIDE * 4).fill(255), left: -6, top: 50, advance: 48 }),
  });
  await registerFont('inter', { weight: 400, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
});

describe('drawText — an emoji', () => {
  it('stages one quad sampled as an image, in its own colors whatever the text color', () => {
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, textCommand('👍🏽', '#ff0000'));
    const quad = verticesOf(stagedVertices(ctx, calls), PAINT_MODE_IMAGE);
    expect(quad).toHaveLength(4);
    for (const v of quad) expect(v).toMatchObject({ rgba: [1, 1, 1, 1], post: 1 });
    expect(quad[2].uv[0] - quad[0].uv[0]).toBeCloseTo(SIDE / 1024);
    expect(quad[2].uv[1] - quad[0].uv[1]).toBeCloseTo(SIDE / 1024);
  });

  it('fades with the text color', () => {
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, textCommand('👍', '#ff000080'));
    const quad = verticesOf(stagedVertices(ctx, calls), PAINT_MODE_IMAGE);
    expect(quad).toHaveLength(4);
    for (const v of quad) expect(v.post).toBeCloseTo(128 / 255);
  });

  it('samples the color page it uploaded', () => {
    const { ctx, calls, gl } = createRecorderCtx();
    dispatch(ctx, textCommand('👍', '#000'));
    stagedVertices(ctx, calls);
    const upload = calls.find((c) => c.name === 'texImage2D' && c.args[3] === 1024 && c.args[2] === gl.RGBA)!;
    expect(upload.args.slice(2, 8)).toEqual([gl.RGBA, 1024, 1024, 0, gl.RGBA, gl.UNSIGNED_BYTE]);
    expect(ctx.textureCache.has(colorPageTextureId(0))).toBe(true);
    const page = calls[calls.indexOf(upload) - 1];
    expect(page.name).toBe('bindTexture');
    const draw = calls.findIndex((c) => c.name === 'drawElements');
    const bound = calls.slice(0, draw).filter((c) => c.name === 'bindTexture' && c.args[1] === page.args[1]);
    expect(bound.length).toBeGreaterThan(1);
  });

  it('shares a draw with the text around it', () => {
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, textCommand('A👍B', '#000'));
    const verts = stagedVertices(ctx, calls);
    expect(verticesOf(verts, GLYPH_MODE_MSDF)).toHaveLength(8);
    expect(verticesOf(verts, PAINT_MODE_IMAGE)).toHaveLength(4);
    expect(calls.filter((c) => c.name === 'drawElements')).toHaveLength(1);
  });
});
