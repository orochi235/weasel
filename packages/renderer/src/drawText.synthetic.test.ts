import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { dispatch, type DrawContext } from './draw';
import { FLOATS_PER_VERTEX } from './drawBatch';
import { createRecorderCtx, stagedVertices } from './testing/recorderCtx';

describe('drawText synthetic-bold', () => {
  /** The threshold shift each staged vertex carries, in `a_post` beside the
   *  corner a quad grown for area coverage adds (`shaders/glyphCell.ts`). */
  const boldValues = (ctx: DrawContext, calls: readonly { name: string; args: readonly unknown[] }[]): number[] => {
    const v = stagedVertices(ctx, calls);
    const out: number[] = [];
    for (let i = 0; i < v.length; i += FLOATS_PER_VERTEX) out.push(v[i + 8] - 2 * Math.floor(v[i + 8] / 2));
    return out;
  };

  beforeEach(() => {
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
  });

  it('shifts the SDF threshold by ~0.08 when a group has synthetic.bold=true', async () => {
    _resetFontRegistryForTests();
    // Register only the regular weight; request bold via a run → synthetic.bold=true
    await registerFont('inter', { weight: 400, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, {
      kind: 'text', x: 0, y: 0,
      runs: [{
        text: 'A', fontFamily: 'inter', fontSize: 16, fontWeight: 700,
        fontStyle: 'normal', fill: { paint: { kind: 'solid', color: '#000' } },
        letterSpacing: 0,
        underline: false, strikethrough: false, overline: false, baselineShift: 0,
      }],
      maxWidth: Infinity, align: 'left', style: {},
    });
    const sent = boldValues(ctx, calls);
    expect(sent).toHaveLength(4);
    expect(sent.every((v) => Math.abs(v - 0.08) < 1e-6)).toBe(true);
  });

  it('leaves the threshold alone for an exact-match variant', async () => {
    _resetFontRegistryForTests();
    await registerFont('inter', { weight: 700, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, {
      kind: 'text', x: 0, y: 0,
      runs: [{
        text: 'A', fontFamily: 'inter', fontSize: 16, fontWeight: 700,
        fontStyle: 'normal', fill: { paint: { kind: 'solid', color: '#000' } },
        letterSpacing: 0,
        underline: false, strikethrough: false, overline: false, baselineShift: 0,
      }],
      maxWidth: Infinity, align: 'left', style: {},
    });
    expect(boldValues(ctx, calls)).toEqual([0, 0, 0, 0]);
  });
});

describe('drawText synthetic-italic', () => {
  /**
   * How far the top of a staged glyph quad leans right of its bottom, as a
   * fraction of the quad's height.
   *
   * The shear moved from the vertex shader to `pushGlyph`, which places the
   * corners itself: `x += (baselineY - y) * tan(angle)`, so top minus bottom is
   * the quad's height times the tangent whatever the baseline is. Corners wind
   * top-left, top-right, bottom-right, bottom-left.
   */
  const leanPerHeight = (ctx: DrawContext, calls: readonly { name: string; args: readonly unknown[] }[]): number => {
    const v = stagedVertices(ctx, calls);
    const topLeftX = v[0], topLeftY = v[1];
    const bottomLeftX = v[3 * FLOATS_PER_VERTEX], bottomLeftY = v[3 * FLOATS_PER_VERTEX + 1];
    return (topLeftX - bottomLeftX) / (bottomLeftY - topLeftY);
  };

  beforeEach(() => {
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
  });

  it('leans a glyph by tan(12°) when a group has synthetic.italic=true', async () => {
    _resetFontRegistryForTests();
    await registerFont('inter', { weight: 400, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, {
      kind: 'text', x: 0, y: 0,
      runs: [{
        text: 'A', fontFamily: 'inter', fontSize: 16, fontWeight: 400,
        fontStyle: 'italic', fill: { paint: { kind: 'solid', color: '#000' } },
        letterSpacing: 0,
        underline: false, strikethrough: false, overline: false, baselineShift: 0,
      }],
      maxWidth: Infinity, align: 'left', style: {},
    });
    expect(leanPerHeight(ctx, calls)).toBeCloseTo(Math.tan(0.2094), 4);
  });

  it('leaves an exact-match italic variant upright, the face doing the leaning', async () => {
    _resetFontRegistryForTests();
    await registerFont('inter', { weight: 400, style: 'italic' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, {
      kind: 'text', x: 0, y: 0,
      runs: [{
        text: 'A', fontFamily: 'inter', fontSize: 16, fontWeight: 400,
        fontStyle: 'italic', fill: { paint: { kind: 'solid', color: '#000' } },
        letterSpacing: 0,
        underline: false, strikethrough: false, overline: false, baselineShift: 0,
      }],
      maxWidth: Infinity, align: 'left', style: {},
    });
    expect(leanPerHeight(ctx, calls)).toBe(0);
  });
});
