import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  GLYPH_MODE_MSDF, registerFont, FIXTURE_FONT, registerFontOutlines, glyphOutline,
} from '@weasel-js/font';
import {
  _resetFontRegistryForTests, _resetDynamicFontsForTests, _resetFontOutlinesForTests,
} from '@weasel-js/font/test-seams';
import type { makeGLRecorder } from './testing/glRecorder';
import type { DrawCommand } from './DrawCommand';
import { _resetOutlineMeshCacheForTests } from './cache/outlineMeshCache';
import { dispatch, type DrawContext } from './draw';
import { FLOATS_PER_VERTEX } from './drawBatch';
import { createRecorderCtx, stagedVertices, paintModes, positionsOfMode } from './testing/recorderCtx';

/**
 * The outline tier's renderer half. Layout decides *which* glyphs escalate
 * (see `layoutRuns.test.ts`); these assert what the renderer then does with
 * them — which program it binds, that a group is still one draw call, and
 * that em-space geometry lands where the glyph was laid out.
 */
describe('drawText — outline tier', () => {
  // A unit triangle: apex one em above the baseline, base on it.
  const GLYPH_D = 'M0 0L1 0L0.5 -1Z';
  const SIZE = 100; // comfortably past the 48-screen-px threshold at scale 1

  beforeEach(async () => {
    _resetFontRegistryForTests();
    _resetDynamicFontsForTests();
    _resetFontOutlinesForTests();
    _resetOutlineMeshCacheForTests();
    const encoder = new TextEncoder();
    global.fetch = vi.fn().mockImplementation((url: string) =>
      url.endsWith('.json')
        ? Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_FONT) })
        : Promise.resolve({
            ok: true,
            blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })),
          })) as typeof fetch;
    global.createImageBitmap = vi.fn().mockResolvedValue(
      { width: 512, height: 512, close: vi.fn() } as unknown as ImageBitmap);
    await registerFont('inter', { weight: 400, style: 'normal' }, '/f.json', '/f.png');

    registerFontOutlines('inter', { weight: 400, style: 'normal' }, new ArrayBuffer(4), {
      parser: () => ({ unitsPerEm: 1000, ascender: 0.8, advanceOf: (cp: number) => (cp === 32 ? 0.25 : 0.6), kernOf: () => 0, glyphD: (cp: number) => (cp === 32 ? null : GLYPH_D) }),
    });
    // Drive the (async) face load to ready, the way a second frame would.
    glyphOutline('inter', 400, 'normal', 65);
    await new Promise((r) => setTimeout(r, 0));
  });

  const textCmd = (text: string, extra: Partial<Record<string, unknown>> = {}): DrawCommand => ({
    kind: 'text',
    x: 0, y: 0,
    runs: [{
      text, fontFamily: 'inter', fontWeight: 400, fontStyle: 'normal',
      fontSize: SIZE, fill: { paint: { kind: 'solid', color: '#000' } },
      letterSpacing: 0, underline: false, strikethrough: false,
      overline: false, baselineShift: 0, ...extra,
    }],
    maxWidth: Infinity, align: 'left', style: {},
  } as DrawCommand);

  /** The (x, y) of every vertex this frame staged, in staging order. */
  const outlineXY = (ctx: DrawContext, calls: ReturnType<typeof makeGLRecorder>['calls']): number[] =>
    positionsOfMode(ctx, calls, 0);

  /**
   * The staged vertex indices painted in `rgba`.
   *
   * A glyph's fill and its stroke ribbon share one draw now, so the color is
   * what tells them apart inside the buffer — and where they sit in it is the
   * paint order: everything the fill staged comes before everything the stroke
   * did.
   */
  const indicesColored = (
    ctx: DrawContext,
    calls: ReturnType<typeof makeGLRecorder>['calls'],
    rgba: number[],
  ): number[] => {
    const v = stagedVertices(ctx, calls);
    const out: number[] = [];
    for (let i = 0; i < v.length; i += FLOATS_PER_VERTEX) {
      if (rgba.every((want, k) => Math.abs(v[i + 2 + k] - want) < 1e-6)) out.push(i / FLOATS_PER_VERTEX);
    }
    return out;
  };
  const BLACK = [0, 0, 0, 1];
  const RED = [1, 0, 0, 1];

  it('draws outline glyphs as geometry, not off an atlas', () => {
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, textCmd('A'));
    // Tessellated triangles are solid geometry like any other, so the run
    // carries them at paint mode 0 and no glyph mode appears at all.
    expect(paintModes(ctx, calls)).toEqual(new Set([0]));
  });

  it('batches a whole group into one draw call', () => {
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, textCmd('AAAA'));
    // Four glyphs, one buffer, one draw — the batching the atlas tier gets
    // from packing glyphs into a texture. A model matrix per glyph would have
    // traded that away.
    expect(outlineXY(ctx, calls)).toHaveLength(4 * 3 * 2); // 4 glyphs × 3 vertices × (x, y)
    expect(calls.filter((c) => c.name === 'drawElements')).toHaveLength(1);
  });

  it('places em-space geometry at the pen and baseline, scaled by fontSize', () => {
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, textCmd('A'));
    const v = outlineXY(ctx, calls);

    const ys = [v[1], v[3], v[5]];
    const xs = [v[0], v[2], v[4]];
    // The triangle's base sits on the baseline and its apex one em above.
    const baselineY = Math.max(...ys);
    expect(Math.min(...ys)).toBeCloseTo(baselineY - SIZE, 4);
    // One em wide, starting at the pen (x = 0 for the first glyph of a
    // left-aligned line at origin 0).
    expect(Math.min(...xs)).toBeCloseTo(0, 4);
    expect(Math.max(...xs)).toBeCloseTo(SIZE, 4);
  });

  it('shears synthetic obliques the same way the atlas tier does', () => {
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, textCmd('A', { fontStyle: 'italic' }));
    const v = outlineXY(ctx, calls);

    const ys = [v[1], v[3], v[5]];
    const xs = [v[0], v[2], v[4]];
    const apex = ys.indexOf(Math.min(...ys));
    // `x += (baselineY - y) * tan(12°)`: a vertex one em above the baseline
    // leans right by tan(12°) em. Below-baseline vertices lean the other way,
    // which is what keeps the glyph attached to its own baseline.
    expect(xs[apex] - 0.5 * SIZE).toBeCloseTo(Math.tan(0.2094) * SIZE, 3);
  });

  it('leaves small text on the atlas tier', () => {
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, textCmd('A', { fontSize: 12 }));
    expect(paintModes(ctx, calls)).toContain(GLYPH_MODE_MSDF);
  });

  it('pulls small text across the threshold once the view is zoomed in', () => {
    const { ctx, calls } = createRecorderCtx();
    // 12 world px at 8× is 96 on screen — the rule is what the eye sees, not
    // what the document says.
    ctx.state.push({ transform: new Float32Array([8, 0, 0, 0, 8, 0, 0, 0, 1]) });
    dispatch(ctx, textCmd('A', { fontSize: 12 }));
    ctx.state.pop();
    expect(paintModes(ctx, calls)).toEqual(new Set([0]));
  });

  it('honours a renderer that turns the tier off', () => {
    const { ctx, calls } = createRecorderCtx();
    ctx.textOutlineMinScreenSize = Infinity;
    dispatch(ctx, textCmd('A'));
    expect(paintModes(ctx, calls)).toEqual(new Set([GLYPH_MODE_MSDF]));
  });

  it('moves outline glyphs with verticalAlign, like the quads', () => {
    const top = createRecorderCtx();
    dispatch(top.ctx, { ...textCmd('A'), height: 400, verticalAlign: 'top' } as DrawCommand);
    const bottom = createRecorderCtx();
    dispatch(bottom.ctx, { ...textCmd('A'), height: 400, verticalAlign: 'bottom' } as DrawCommand);

    expect(outlineXY(bottom.ctx, bottom.calls)[1])
      .toBeGreaterThan(outlineXY(top.ctx, top.calls)[1]);
  });

  /**
   * Stroked text. A glyph on this tier is an ordinary `PolygonPath`, so the
   * stroke is the same tessellated ribbon any path gets — real joins, caps
   * and miters, at any width, in any paint.
   */
  describe('stroke', () => {
    const STROKE = { paint: { kind: 'solid' as const, color: '#f00' }, width: 4 };

    it('batches the stroke over the group, as the fill is', () => {
      const stroked = createRecorderCtx();
      dispatch(stroked.ctx, textCmd('AAAA', { stroke: STROKE }));
      // Four glyphs' fill and four glyphs' stroke, each batched over the whole
      // group — and both in the one run, which is why this is a single draw.
      expect(indicesColored(stroked.ctx, stroked.calls, BLACK)).toHaveLength(4 * 3);
      expect(indicesColored(stroked.ctx, stroked.calls, RED).length).toBeGreaterThan(4 * 3);
      expect(stroked.calls.filter((c) => c.name === 'drawElements')).toHaveLength(1);
    });

    it('paints the stroke over the fill', () => {
      const { ctx, calls } = createRecorderCtx();
      dispatch(ctx, textCmd('A', { stroke: STROKE }));
      const fill = indicesColored(ctx, calls, BLACK);
      const stroke = indicesColored(ctx, calls, RED);
      // The fill is the glyph's 3 vertices; the ribbon is larger. Order in the
      // buffer is order on screen: fill first, stroke on top, as Canvas2D and
      // SVG's default paint-order both do it.
      expect(fill).toHaveLength(3);
      expect(stroke.length).toBeGreaterThan(fill.length);
      expect(Math.max(...fill)).toBeLessThan(Math.min(...stroke));
    });

    it('straddles the glyph edge by half the stroke width', () => {
      const { ctx, calls } = createRecorderCtx();
      // Round joins on purpose: their outer boundary is an arc of half the
      // width about each corner, so the ribbon is bounded by exactly half a
      // width everywhere. A miter at this glyph's sharp corners overshoots
      // that legitimately, which would make the assertion about the join
      // rather than about the width.
      dispatch(ctx, textCmd('A', { stroke: { ...STROKE, join: 'round', cap: 'round' } }));
      const xy = outlineXY(ctx, calls);
      const xs = indicesColored(ctx, calls, RED).map((v) => xy[v * 2]);
      // The glyph spans x ∈ [0, SIZE]. A centred 4-unit stroke reaches half a
      // width outside it on each side, in world units — the stroke width is
      // not scaled by the font size. Precision 1 because the join arcs are
      // flattened at OUTLINE_FLATTEN_TOLERANCE em, which is ~0.02 world units
      // at this size.
      expect(Math.min(...xs)).toBeCloseTo(-STROKE.width / 2, 1);
      expect(Math.max(...xs)).toBeCloseTo(SIZE + STROKE.width / 2, 1);
    });

    it('draws nothing extra for a zero-width stroke', () => {
      const { ctx, calls } = createRecorderCtx();
      dispatch(ctx, textCmd('A', { stroke: { ...STROKE, width: 0 } }));
      expect(indicesColored(ctx, calls, RED)).toHaveLength(0);
      expect(calls.filter((c) => c.name === 'drawElements')).toHaveLength(1);
    });

    it('paints only the ribbon for `fill: null` — outline-only text', () => {
      const { ctx, calls } = createRecorderCtx();
      dispatch(ctx, textCmd('AAAA', { fill: null, stroke: STROKE }));
      // One draw, and nothing in it is the fill.
      expect(indicesColored(ctx, calls, BLACK)).toHaveLength(0);
      expect(indicesColored(ctx, calls, RED).length).toBeGreaterThan(4 * 3);
      expect(calls.filter((c) => c.name === 'drawElements')).toHaveLength(1);
    });

    it('draws nothing at all for `fill: null` with no stroke', () => {
      const { ctx, calls } = createRecorderCtx();
      dispatch(ctx, textCmd('AAAA', { fill: null }));
      expect(calls.filter((c) => c.name === 'drawElements')).toHaveLength(0);
    });

    it('escalates small text to outlines rather than dropping its stroke', () => {
      const { ctx, calls } = createRecorderCtx();
      dispatch(ctx, textCmd('A', { fontSize: 12, stroke: STROKE }));
      // The size threshold picks between two correct renderings of unstroked
      // text. For a stroked run it would pick between a stroke and none, so
      // the run escalates at any size and the atlas tier never sees it.
      expect(paintModes(ctx, calls)).toEqual(new Set([0]));
    });
  });
});
