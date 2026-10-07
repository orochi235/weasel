/**
 * A `{ px }` stroke on outlined text is that many pixels wide on screen in
 * every direction under a non-uniform transform, as a path's is — and a
 * stroke's dashes are in its width's units, not the glyph's em.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Stroke } from '@weasel-js/core';
import { registerFont, FIXTURE_FONT, registerFontOutlines, glyphOutline } from '@weasel-js/font';
import { _resetFontRegistryForTests, _resetFontOutlinesForTests } from '@weasel-js/font/test-seams';
import { makeGLRecorder } from './test-utils/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';
import { mat3, type GlMat3 } from './math/mat3';
import { FLOATS_PER_VERTEX } from './drawBatch';
import { _resetOutlineMeshCacheForTests } from './cache/outlineMeshCache';
import { _resetOutlineStrokeMeshCacheForTests } from './cache/outlineStrokeMeshCache';

type Point = [number, number];

/** A unit square sitting on the baseline, drawn from its bottom-left corner
 *  along the baseline first. */
const GLYPH_D = 'M0 0L1 0L1 -1L0 -1Z';
const SIZE = 128;
const FOUR_TO_ONE = mat3.scaled(mat3.identity(), 4, 1);

/** The red ribbon's batched vertices, on screen, in staging order. */
function ribbon(rec: ReturnType<typeof makeGLRecorder>): Point[] {
  const out: Point[] = [];
  for (const call of rec.calls) {
    if (call.name !== 'bufferSubData') continue;
    const data = call.args[2];
    const count = call.args[4];
    if (!(data instanceof Float32Array) || typeof count !== 'number') continue;
    for (let i = 0; i + FLOATS_PER_VERTEX <= count; i += FLOATS_PER_VERTEX) {
      if (data[i + 2] > 0.5) out.push([data[i], data[i + 1]]);
    }
  }
  return out;
}

const span = (pts: Point[], axis: 0 | 1) =>
  Math.max(...pts.map((p) => p[axis])) - Math.min(...pts.map((p) => p[axis]));

describe('outlined text — stroke lengths', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  let r: WeaselRenderer;

  beforeEach(async () => {
    _resetFontRegistryForTests();
    _resetFontOutlinesForTests();
    _resetOutlineMeshCacheForTests();
    _resetOutlineStrokeMeshCacheForTests();
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
      parser: () => ({
        unitsPerEm: 1000, ascender: 0.8, advanceOf: () => 1, kernOf: () => 0,
        glyphD: (cp: number) => (cp === 32 ? null : GLYPH_D),
      }),
    });
    glyphOutline('inter', 400, 'normal', 65);
    await new Promise((res) => setTimeout(res, 0));
    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
  });

  const frame = (stroke: Stroke, transform: GlMat3 = FOUR_TO_ONE) => {
    recorder.reset();
    r.render([{
      kind: 'group',
      transform,
      children: [{
        kind: 'text',
        x: 0, y: 0,
        runs: [{
          text: 'A', fontFamily: 'inter', fontWeight: 400, fontStyle: 'normal',
          fontSize: SIZE, fill: null, stroke,
          letterSpacing: 0, underline: false, strikethrough: false,
          overline: false, baselineShift: 0,
        }],
        maxWidth: Infinity, align: 'left', style: {},
      }],
    } as DrawCommand]);
    return ribbon(recorder);
  };

  const red = { fill: 'solid' as const, color: '#ff0000' };

  // The square is 512px wide and 128px tall on screen; a 1px miter-joined
  // ribbon adds half a pixel outside each edge. Through the mean scale of 2 it
  // added a whole pixel across and a quarter down.
  it('outlines a glyph one pixel thick on both axes', () => {
    const pts = frame({ paint: red, width: { px: 1 }, join: 'miter' });
    expect(pts.length).toBeGreaterThan(0);
    expect(span(pts, 0)).toBeCloseTo(513, 3);
    expect(span(pts, 1)).toBeCloseTo(129, 3);
  });

  it('dashes a { px } glyph stroke in screen pixels', () => {
    const pts = frame({ paint: red, width: { px: 1 }, dash: [24, 16] });
    // The pattern fits the 1280px outline whole, so the first dash starts at
    // the corner and runs along the baseline: four vertices, butt-capped.
    expect(span(pts.slice(0, 4), 0)).toBeCloseTo(24, 3);
  });

  it('dashes a world-width glyph stroke in world units', () => {
    const pts = frame({ paint: red, width: 1, dash: [32, 32] }, mat3.identity());
    expect(span(pts.slice(0, 4), 0)).toBeCloseTo(32, 3);
  });

  it('stays in one batched draw', () => {
    frame({ paint: red, width: { px: 1 }, dash: [24, 16] });
    expect(recorder.calls.filter((c) => c.name === 'drawElements')).toHaveLength(1);
  });
});
