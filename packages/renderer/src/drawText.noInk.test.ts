import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests, _resetDynamicFontsForTests } from '@weasel-js/font/test-seams';
import type { Fill, Stroke } from '@weasel-js/paint';
import { dispatch } from './draw';
import { FLOATS_PER_VERTEX } from './drawBatch';
import { createRecorderCtx, stagedVertices } from './testing/recorderCtx';

/**
 * A run with no paint in its fill puts down no ink. On an SDF tier there is no
 * geometry for a stroke either, so such a run draws nothing at all.
 */
describe('drawText — a run with no ink, on the atlas tier', () => {
  beforeEach(async () => {
    _resetFontRegistryForTests();
    _resetDynamicFontsForTests();
    const encoder = new TextEncoder();
    global.fetch = vi.fn().mockImplementation((url: string) => (url.endsWith('.json')
      ? Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_FONT) })
      : Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })),
      }))) as typeof fetch;
    global.createImageBitmap = vi.fn().mockResolvedValue({
      width: 512, height: 512, close: vi.fn(),
    } as unknown as ImageBitmap);
    await registerFont('inter', { weight: 400, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
  });

  /** How many glyph quads drawing `AB` with `fill` stages, and how many draws it makes. */
  function drawn(fill: Fill | null, stroke?: Stroke): { quads: number; draws: number } {
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, {
      kind: 'text', x: 0, y: 0,
      runs: [{
        text: 'AB', fontFamily: 'inter', fontSize: 32, fontWeight: 400, fontStyle: 'normal',
        fill, ...(stroke ? { stroke } : {}), letterSpacing: 0,
        underline: true, strikethrough: false, overline: false, baselineShift: 0,
      }],
      maxWidth: Infinity, align: 'left', style: {},
    });
    const quads = stagedVertices(ctx, calls).length / (4 * FLOATS_PER_VERTEX);
    return { quads, draws: calls.filter((c) => c.name === 'drawElements').length };
  }

  const SOLID: Fill = { paint: { kind: 'solid', color: '#000' } };
  const STROKE: Stroke = { paint: { kind: 'solid', color: '#f00' }, width: 2 };

  it('draws the glyphs and their underline for a fill with paint', () => {
    expect(drawn(SOLID).quads).toBeGreaterThanOrEqual(2);
  });

  it('draws nothing for a fill that holds no paint', () => {
    expect(drawn({})).toEqual({ quads: 0, draws: 0 });
  });

  it('draws nothing for a null fill', () => {
    expect(drawn(null)).toEqual({ quads: 0, draws: 0 });
  });

  it('draws nothing for an unfilled run with a stroke, which no atlas glyph can carry', () => {
    expect(drawn({}, STROKE)).toEqual({ quads: 0, draws: 0 });
  });
});
