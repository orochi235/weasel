import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  GLYPH_MODE_MSDF, registerFont, FIXTURE_FONT, registerCanvasFont, resetBakeBudget,
} from '@weasel-js/font';
import {
  _resetFontRegistryForTests, _resetDynamicFontsForTests, __setGlyphRasterizerForTests,
} from '@weasel-js/font/test-seams';
import type { makeGLRecorder } from './testing/glRecorder';
import type { DrawCommand } from './DrawCommand';
import { drawGroup, dispatch, type DrawContext } from './draw';
import { FLOATS_PER_VERTEX, TEX_SLOT_OFFSET } from './drawBatch';
import { paintModeOf } from './shaders/batchFill';
import {
  createRecorderCtx, isBatchBuild, stagedVertices, paintModes, positionsOfMode, NOTCHED_CLIP,
} from './testing/recorderCtx';

/**
 * Decoration is a producer/consumer feature with exactly the shape that hides
 * bugs: layout can compute a perfect rule and the renderer can silently drop
 * it, leaving text that measures right and paints no line. So these assert on
 * the draw calls and the uploaded vertex data, never on `LaidOutRuns`.
 */
describe('drawText — decoration reaches the GPU', () => {
  beforeEach(async () => {
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
  });

  /** Float32Array truncation means an exact `toEqual` on decimals fails. */
  function expectVertices(actual: number[], expected: number[]): void {
    expect(actual).toHaveLength(expected.length);
    for (let i = 0; i < expected.length; i++) expect(actual[i]).toBeCloseTo(expected[i], 4);
  }

  /**
   * The staged quads carrying `mode`, each as its four corners and the color
   * its vertices carry.
   *
   * Reads the run four vertices at a time, which holds for text: glyphs and
   * rules are quads. A tessellated mesh in the same run would break the
   * stride, and nothing here stages one.
   */
  function quadsOfMode(
    ctx: DrawContext,
    calls: ReturnType<typeof makeGLRecorder>['calls'],
    mode: number,
  ): Array<{ corners: number[]; rgba: number[] }> {
    const v = stagedVertices(ctx, calls);
    const out: Array<{ corners: number[]; rgba: number[] }> = [];
    for (let i = 0; i < v.length; i += 4 * FLOATS_PER_VERTEX) {
      if (paintModeOf(v[i + TEX_SLOT_OFFSET]) !== mode) continue;
      const corners: number[] = [];
      for (let k = 0; k < 4; k++) {
        corners.push(v[i + k * FLOATS_PER_VERTEX], v[i + k * FLOATS_PER_VERTEX + 1]);
      }
      out.push({ corners, rgba: [v[i + 2], v[i + 3], v[i + 4], v[i + 5]] });
    }
    return out;
  }

  const decoratedRun = (extra: Record<string, unknown>) => ({
    text: 'A', fontFamily: 'inter', fontSize: 32, fontWeight: 400,
    fontStyle: 'normal' as const, fill: { paint: { kind: 'solid' as const, color: '#000' } },
    letterSpacing: 0, underline: false, strikethrough: false, overline: false,
    baselineShift: 0, ...extra,
  });

  // FIXTURE_FONT at fontSize 32 → scale 1: 'A' advances 23, baseline is at
  // common.base = 29. Underline top = 29 + 0.10*32 = 32.2, 0.05*32 = 1.6 thick.
  it('stages the underline rect with the glyphs it underlines', () => {
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, {
      kind: 'text', x: 0, y: 0,
      runs: [decoratedRun({ underline: true })],
      maxWidth: Infinity, align: 'left', style: {},
    } as DrawCommand);

    const rules = quadsOfMode(ctx, calls, 0);
    expect(rules).toHaveLength(1);
    // Corners wind top-left, top-right, bottom-right, bottom-left.
    expectVertices(rules[0].corners, [0, 32.2, 23, 32.2, 23, 33.8, 0, 33.8]);
    // The glyph and its rule are one draw.
    expect(calls.filter((c) => c.name === 'drawElements')).toHaveLength(1);
  });

  it('stages no rule when decoration is off', () => {
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, {
      kind: 'text', x: 0, y: 0,
      runs: [decoratedRun({})],
      maxWidth: Infinity, align: 'left', style: {},
    } as DrawCommand);
    // No rule staged — the glyph is the only thing in the run.
    expect(positionsOfMode(ctx, calls, 0)).toHaveLength(0);
    expect(positionsOfMode(ctx, calls, GLYPH_MODE_MSDF)).toHaveLength(8);
  });

  it('emits the strikethrough rect above the baseline', () => {
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, {
      kind: 'text', x: 0, y: 0,
      runs: [decoratedRun({ strikethrough: true })],
      maxWidth: Infinity, align: 'left', style: {},
    } as DrawCommand);
    const rules = quadsOfMode(ctx, calls, 0);
    expect(rules).toHaveLength(1);
    // Top = 29 - 0.30*32 = 19.4, bottom = 21.
    expectVertices(rules[0].corners, [0, 19.4, 23, 19.4, 23, 21, 0, 21]);
  });

  it('puts both rules of a doubly-decorated run in the glyph\'s own draw', () => {
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, {
      kind: 'text', x: 0, y: 0,
      runs: [decoratedRun({ underline: true, strikethrough: true })],
      maxWidth: Infinity, align: 'left', style: {},
    } as DrawCommand);
    expect(quadsOfMode(ctx, calls, 0)).toHaveLength(2);
    // One glyph and two rules: 3 quads, 18 indices, one draw.
    const draws = calls.filter((c) => c.name === 'drawElements');
    expect(draws).toHaveLength(1);
    expect(draws[0].args[1]).toBe(18);
  });

  it('paints each rule in its own run\'s fill, without splitting the draw', () => {
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, {
      kind: 'text', x: 0, y: 0,
      runs: [
        decoratedRun({ underline: true }),
        decoratedRun({ text: 'B', underline: true, fill: { paint: { kind: 'solid', color: '#ff0000' } } }),
      ],
      maxWidth: Infinity, align: 'left', style: {},
    } as DrawCommand);
    // The color rides the vertices, so two colors are one draw — where the
    // rule used to be a `u_color` uniform and a second color cost a draw.
    expect(quadsOfMode(ctx, calls, 0).map((q) => q.rgba)).toEqual([[0, 0, 0, 1], [1, 0, 0, 1]]);
    expect(calls.filter((c) => c.name === 'drawElements')).toHaveLength(1);
  });

  it('takes a solid fill\'s opacity into the glyphs\' alpha and the rule\'s', () => {
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, {
      kind: 'text', x: 0, y: 0,
      runs: [decoratedRun({ underline: true, fill: { paint: { kind: 'solid', color: '#ff0000', opacity: 0.25 } } })],
      maxWidth: Infinity, align: 'left', style: {},
    } as DrawCommand);
    expect(quadsOfMode(ctx, calls, 0).map((q) => q.rgba)).toEqual([[1, 0, 0, 0.25]]);
    expect(quadsOfMode(ctx, calls, GLYPH_MODE_MSDF).map((q) => q.rgba)).toEqual([[1, 0, 0, 0.25]]);
  });

  it('shifts the rule by the verticalAlign offset, with the glyphs', () => {
    const runs = [decoratedRun({ underline: true })];
    const cmd = { kind: 'text', x: 0, y: 0, runs, maxWidth: Infinity, align: 'left', style: {} };

    const { ctx: ctxA, calls: callsA } = createRecorderCtx();
    dispatch(ctxA, cmd as DrawCommand);
    const { ctx: ctxB, calls: callsB } = createRecorderCtx();
    dispatch(ctxB, { ...cmd, height: 100, verticalAlign: 'center' } as DrawCommand);

    const yA = positionsOfMode(ctxA, callsA, 0)[1];
    const yB = positionsOfMode(ctxB, callsB, 0)[1];
    const glyphYA = positionsOfMode(ctxA, callsA, GLYPH_MODE_MSDF)[1];
    const glyphYB = positionsOfMode(ctxB, callsB, GLYPH_MODE_MSDF)[1];
    expect(yB - yA).not.toBe(0);
    // The rule must move by exactly what the glyphs moved by, or it detaches.
    expect(yB - yA).toBeCloseTo(glyphYB - glyphYA, 6);
  });

  it('draws the rule when nothing has baked yet, so there are no groups at all', () => {
    // A canvas-dynamic glyph past the bake budget lays out with a real advance
    // but `page: -1`, which emits no quad. Layout therefore returns zero
    // groups while still carrying the rule; a `groups.length === 0` bail-out
    // in drawText would swallow it.
    _resetDynamicFontsForTests();
    __setGlyphRasterizerForTests({
      faceMetrics: () => ({ ascent: 40, descent: 8 }),
      rasterize: () => ({
        width: 20, height: 24, alpha: new Uint8ClampedArray(20 * 24).fill(255),
        left: -8, top: 26, advance: 22,
      }),
    });
    registerCanvasFont('Dyn');
    resetBakeBudget(0);
    try {
      const { ctx, calls } = createRecorderCtx();
      dispatch(ctx, {
        kind: 'text', x: 0, y: 0,
        runs: [decoratedRun({ fontFamily: 'Dyn', underline: true })],
        maxWidth: Infinity, align: 'left', style: {},
      } as DrawCommand);
      expect(paintModes(ctx, calls)).toEqual(new Set([0]));
      // One rule, four corners, and no glyph to sit under.
      expect(positionsOfMode(ctx, calls, 0)).toHaveLength(8);
    } finally {
      resetBakeBudget();
      _resetDynamicFontsForTests();
    }
  });

  it('draws the rule under the enclosing clip, as the glyphs are', () => {
    const { ctx, calls } = createRecorderCtx();
    drawGroup(ctx, {
      kind: 'group',
      clip: NOTCHED_CLIP,
      children: [{
        kind: 'text', x: 0, y: 0,
        runs: [decoratedRun({ underline: true })],
        maxWidth: Infinity, align: 'left', style: {},
      }],
    } as never);
    // The rule's draw must be issued with the clip stencil live, or it spills
    // past the group's clip rect. The rule stages into the batch now, so the
    // anchor is the batch's own draw — which `popClip` forces before it lifts
    // the mask.
    let bound: unknown = null;
    let at = -1;
    for (let i = 0; i < calls.length; i++) {
      if (calls[i].name === 'useProgram') bound = calls[i].args[0];
      if (calls[i].name === 'drawElements' && isBatchBuild(ctx, bound)) { at = i; break; }
    }
    expect(at).toBeGreaterThanOrEqual(0);
    let enabled = false;
    let func: unknown[] | null = null;
    for (const c of calls.slice(0, at)) {
      if (c.name === 'enable' && c.args[0] === 0x0B90) enabled = true;
      if (c.name === 'disable' && c.args[0] === 0x0B90) enabled = false;
      if (c.name === 'stencilFunc') func = c.args as unknown[];
    }
    expect(enabled).toBe(true);
    // EQUAL against the depth-1 ancestor mask (bit 1 → 0x02).
    expect(func).toEqual([0x0202, 0x02, 0x02]);
  });

  it('maps the rule through the group color matrix and alpha, as the glyph path does', () => {
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, {
      kind: 'group',
      alpha: 0.5,
      // Row-major 4×5 that swaps the red and green channels.
      colorMatrix: [
        0, 1, 0, 0, 0,
        1, 0, 0, 0, 0,
        0, 0, 1, 0, 0,
        0, 0, 0, 1, 0,
      ],
      children: [{
        kind: 'text', x: 0, y: 0,
        runs: [decoratedRun({ underline: true, fill: { paint: { kind: 'solid', color: '#ff0000' } } })],
        maxWidth: Infinity, align: 'left', style: {},
      }],
    } as DrawCommand);
    // The glyph quad and its rule: red swapped to green and faded by the
    // group, on every vertex, so the rule is tinted and faded like the glyph.
    const v = stagedVertices(ctx, calls);
    expect(v).toHaveLength(2 * 4 * FLOATS_PER_VERTEX);
    for (let i = 0; i < v.length; i += FLOATS_PER_VERTEX) {
      expect(Array.from(v.slice(i + 2, i + 6))).toEqual([0, 1, 0, 0.5]);
    }
    // u_proj / u_model, without which the rect lands in raw clip space.
    const from = calls.findIndex((c) => c.name === 'useProgram' && isBatchBuild(ctx, c.args[0]));
    expect(calls.slice(from).filter((c) => c.name === 'uniformMatrix3fv')).toHaveLength(2);
  });
});
