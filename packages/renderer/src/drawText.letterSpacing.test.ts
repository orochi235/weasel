import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests, _resetDynamicFontsForTests } from '@weasel-js/font/test-seams';
import type { makeGLRecorder } from './testing/glRecorder';
import { dispatch, type DrawContext } from './draw';
import { FLOATS_PER_VERTEX } from './drawBatch';
import { createRecorderCtx, stagedVertices } from './testing/recorderCtx';

/**
 * Tracking is only real if it reaches the vertex buffer. Layout returning
 * wider bounds proves nothing here — this asserts the uploaded quad x's.
 */
describe('drawText — letterSpacing reaches the GPU', () => {
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

  /** x of each staged quad's first corner. */
  function quadX0s(ctx: DrawContext, calls: ReturnType<typeof makeGLRecorder>['calls']): number[] {
    const data = stagedVertices(ctx, calls);
    if (data.length === 0) throw new Error('no text vertex upload recorded');
    const out: number[] = [];
    for (let i = 0; i < data.length; i += 4 * FLOATS_PER_VERTEX) out.push(data[i]);
    return out;
  }

  function drawTracked(letterSpacing: number): number[] {
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, {
      kind: 'text', x: 0, y: 0,
      runs: [{
        text: 'AB', fontFamily: 'inter', fontSize: 32, fontWeight: 400,
        fontStyle: 'normal', fill: { paint: { kind: 'solid', color: '#000' } },
        letterSpacing,
        underline: false, strikethrough: false, overline: false, baselineShift: 0,
      }],
      maxWidth: Infinity, align: 'left', style: {},
    });
    return quadX0s(ctx, calls);
  }

  it('shifts uploaded glyph x-coordinates by N * letterSpacing', () => {
    const plain = drawTracked(0);
    const tracked = drawTracked(6);
    expect(plain).toHaveLength(2);
    expect(tracked).toHaveLength(2);
    expect(tracked[0]).toBeCloseTo(plain[0]);        // first glyph unmoved
    expect(tracked[1] - plain[1]).toBeCloseTo(6);    // second glyph tracked once
  });
});
