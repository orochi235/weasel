import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { resolveTextStyle, layoutRuns, verticalAlignOffset } from '@weasel-js/text';
import type { ResolvedRun } from '@weasel-js/text';
import type { makeGLRecorder } from './testing/glRecorder';
import { dispatch, type DrawContext } from './draw';
import { createRecorderCtx, stagedVertices } from './testing/recorderCtx';

describe('drawText verticalAlign', () => {
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

  /** Top-left y of the first glyph quad the run staged. */
  function firstQuadY0(ctx: DrawContext, calls: ReturnType<typeof makeGLRecorder>['calls']): number {
    const verts = stagedVertices(ctx, calls);
    if (verts.length === 0) throw new Error('no text vertex upload recorded');
    return verts[1];
  }

  it('shifts emitted quad y-coordinates by verticalAlignOffset(verticalAlign, height, textHeight)', async () => {
    _resetFontRegistryForTests();
    await registerFont('inter', { weight: 400, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');

    const runs: ResolvedRun[] = [{
      text: 'A', fontFamily: 'inter', fontSize: 16, fontWeight: 400,
      fontStyle: 'normal', fill: { paint: { kind: 'solid', color: '#000' } },
      letterSpacing: 0,
      underline: false, strikethrough: false, overline: false, baselineShift: 0,
    }];
    const style = {};

    const { ctx: ctxTop, calls: callsTop } = createRecorderCtx();
    dispatch(ctxTop, { kind: 'text', x: 0, y: 0, runs, maxWidth: Infinity, align: 'left', style });
    const y0Top = firstQuadY0(ctxTop, callsTop);

    const boxHeight = 100;
    const { ctx: ctxCentered, calls: callsCentered } = createRecorderCtx();
    dispatch(ctxCentered, {
      kind: 'text', x: 0, y: 0, runs, maxWidth: Infinity, align: 'left', style,
      height: boxHeight, verticalAlign: 'center',
    });
    const y0Centered = firstQuadY0(ctxCentered, callsCentered);

    const resolved = resolveTextStyle(style);
    const laid = layoutRuns(runs, { maxWidth: Infinity, lineHeight: resolved.lineHeight, align: 'left' });
    const expectedDy = verticalAlignOffset('center', boxHeight, laid.bounds.height);

    expect(expectedDy).not.toBe(0);
    expect(y0Centered - y0Top).toBeCloseTo(expectedDy, 5);
  });

  it('leaves quads untouched (dy=0) when verticalAlign/height are omitted', async () => {
    _resetFontRegistryForTests();
    await registerFont('inter', { weight: 400, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');

    const runs: ResolvedRun[] = [{
      text: 'A', fontFamily: 'inter', fontSize: 16, fontWeight: 400,
      fontStyle: 'normal', fill: { paint: { kind: 'solid', color: '#000' } },
      letterSpacing: 0,
      underline: false, strikethrough: false, overline: false, baselineShift: 0,
    }];

    const { ctx: ctxA, calls: callsA } = createRecorderCtx();
    dispatch(ctxA, { kind: 'text', x: 0, y: 0, runs, maxWidth: Infinity, align: 'left', style: {} });

    const { ctx: ctxB, calls: callsB } = createRecorderCtx();
    dispatch(ctxB, { kind: 'text', x: 0, y: 0, runs, maxWidth: Infinity, align: 'left', style: {}, verticalAlign: 'top' });

    expect(firstQuadY0(ctxB, callsB)).toBe(firstQuadY0(ctxA, callsA));
  });
});
