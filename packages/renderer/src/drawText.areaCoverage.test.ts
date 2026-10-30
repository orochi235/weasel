import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests, _resetDynamicFontsForTests } from '@weasel-js/font/test-seams';
import type { DrawCommand } from './DrawCommand';
import { dispatch, flushBatch } from './draw';
import { createRecorderCtx } from './testing/recorderCtx';

/**
 * The batch program's glyph taps cost every fragment of a program that has
 * them, so only a run holding glyphs small enough to need area coverage draws
 * with a build that does. The fixture atlas is 32 texels an em with a field
 * range of 4, so 8 field units an em: 12px text spans 0.67 a pixel, 72px 0.11.
 */
describe('drawText — which batch build a run of atlas glyphs draws with', () => {
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

  const text = (fontSize: number, x = 0): DrawCommand => ({
    kind: 'text', x, y: 0,
    runs: [{
      text: 'AB', fontFamily: 'inter', fontSize, fontWeight: 400, fontStyle: 'normal',
      fill: { paint: { kind: 'solid', color: '#000' } }, letterSpacing: 0,
      underline: false, strikethrough: false, overline: false, baselineShift: 0,
    }],
    maxWidth: Infinity, align: 'left', style: {},
  });
  const rect: DrawCommand = {
    kind: 'path', path: { kind: 'rect', x: 0, y: 100, width: 10, height: 10 }, fill: { paint: { color: '#f00' } },
  };

  /** The program bound at each draw, after dispatching `cmds` and flushing. */
  function programsFor(...cmds: DrawCommand[]) {
    const { ctx, calls } = createRecorderCtx();
    for (const cmd of cmds) dispatch(ctx, cmd);
    flushBatch(ctx);
    const out: unknown[] = [];
    let live: unknown = null;
    for (const c of calls) {
      if (c.name === 'useProgram') live = c.args[0];
      else if (c.name === 'drawElements') out.push(live);
    }
    return { out, plain: ctx.batchFill.handle, area: ctx.batchVariants!.get(false, false, true).handle };
  }

  it('draws large text, and the solids around it, without the taps', () => {
    const { out, plain } = programsFor(rect, text(72));
    expect(out).toEqual([plain]);
  });

  it('draws a run holding small text with the taps, whatever else shares it', () => {
    const { out, area } = programsFor(rect, text(72), text(12, 200));
    expect(out).toEqual([area]);
  });

  it('starts the next run without them', () => {
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, text(12));
    flushBatch(ctx);
    dispatch(ctx, rect);
    flushBatch(ctx);
    const used = calls.filter((c) => c.name === 'useProgram').map((c) => c.args[0]);
    expect(used.at(-1)).toBe(ctx.batchFill.handle);
  });
});
