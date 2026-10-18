import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  registerFont, FIXTURE_FONT, GLYPH_MODE_MSDF, colorPageTextureId, sharpColorPageTextureId, resetBakeBudget,
} from '@weasel-js/font';
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

  it('fades with the fill\'s opacity, as the letters beside it do', () => {
    const { ctx, calls } = createRecorderCtx();
    const command = textCommand('👍', '#ff0000');
    command.runs[0]!.fill = { paint: { kind: 'solid', color: '#ff0000', opacity: 0.25 } } as never;
    dispatch(ctx, command);
    const quad = verticesOf(stagedVertices(ctx, calls), PAINT_MODE_IMAGE);
    for (const v of quad) expect(v.post).toBeCloseTo(0.25);
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

  describe('drawn larger than its bake', () => {
    /** A color glyph whose box scales with the size it is drawn at, `SIDE` at 48px. */
    function scalingRasterizer(): void {
      __setGlyphRasterizerForTests({
        faceMetrics: () => ({ ascent: 40, descent: 8 }),
        rasterize: () => ({ width: 20, height: 24, alpha: new Uint8ClampedArray(20 * 24).fill(255), left: -8, top: 26, advance: 22 }),
        rasterizeColor: (_f, _w, _s, _t, size = 48) => {
          const side = (SIDE * size) / 48;
          return {
            width: side, height: side, rgba: new Uint8ClampedArray(side * side * 4).fill(255),
            left: -size / 8, top: (size * 50) / 48, advance: size,
          };
        },
      });
    }

    function scaled(k: number) {
      return { kind: 'group' as const, transform: Float64Array.of(k, 0, 0, 0, k, 0, 0, 0, 1), children: [textCommand('👍', '#000')] };
    }

    function spans(quad: { uv: number[] }[], positions: number[][]) {
      return {
        uv: quad[2].uv[0] - quad[0].uv[0],
        x: positions[2][0] - positions[0][0],
        x0: positions[0][0],
      };
    }

    function imageQuad(ctx: Parameters<typeof dispatch>[0], calls: Parameters<typeof stagedVertices>[1]) {
      const verts = stagedVertices(ctx, calls);
      const out: { uv: number[] }[] = [];
      const pos: number[][] = [];
      for (let i = 0; i < verts.length; i += FLOATS_PER_VERTEX) {
        if (paintModeOf(verts[i + TEX_SLOT_OFFSET]) !== PAINT_MODE_IMAGE) continue;
        out.push({ uv: [...verts.subarray(i + 6, i + 8)] });
        pos.push([verts[i], verts[i + 1]]);
      }
      return spans(out, pos);
    }

    it('samples a bake at the power of two above its on-screen size, over the same box', () => {
      scalingRasterizer();
      // 32px text at 4x is 128 device px of a 48px bake: 2.67 device px a texel, so the 192px bake.
      const { ctx, calls } = createRecorderCtx();
      dispatch(ctx, scaled(4));
      const sharper = imageQuad(ctx, calls);
      expect(ctx.textureCache.has(sharpColorPageTextureId(0))).toBe(true);
      expect(sharper.uv).toBeCloseTo((SIDE * 4) / 1024);
      // The base bake's box: SIDE texels at 32/48 world units each, from 6 texels left of the pen.
      expect(sharper.x).toBeCloseTo(4 * SIDE * (32 / 48));
      expect(sharper.x0).toBeCloseTo(4 * -6 * (32 / 48));
    });

    it('keeps the base bake at its own size', () => {
      scalingRasterizer();
      const { ctx, calls } = createRecorderCtx();
      dispatch(ctx, scaled(1));
      expect(imageQuad(ctx, calls).uv).toBeCloseTo(SIDE / 1024);
      expect(ctx.textureCache.has(sharpColorPageTextureId(0))).toBe(false);
    });
  });
});
