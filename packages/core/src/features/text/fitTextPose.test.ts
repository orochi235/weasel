/**
 * `fitTextPose` sizes a pose from the layout the renderer paints, so every
 * expectation below is a number that layout produces.
 *
 * The `inter` fixture atlas is baked at size 32 and carries exactly two
 * glyphs — `A` (advance 23) and `B` (advance 22) — plus one kerning pair,
 * `A→B` at -1. At `fontSize: 32` the scale is 1, so those are world units.
 * There is no space glyph, so a space takes the `fontSize * 0.25` fallback
 * advance (8). These tests used to run against a stub where every character
 * measured 10 wide, which is why nothing here caught that the box disagreed
 * with the paint by a kern on every pair.
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { _resetLayoutCacheForTests } from '@weasel-js/text/test-seams';
import { fitTextPose } from './fitTextPose';
import type { TextPose } from '@weasel-js/text';

const SIZE = 32;
const STYLE = { fontFamily: 'inter', fontSize: SIZE };
/** `fontSize * lineHeight` at the 1.2 default. */
const LINE = SIZE * 1.2;

describe('fitTextPose', () => {
  beforeEach(async () => {
    _resetFontRegistryForTests();
    _resetLayoutCacheForTests();
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
    await registerFont('inter', {}, '/fonts/inter.json', '/fonts/inter.png');
    _resetLayoutCacheForTests();
  });

  function textPose(over: Partial<TextPose> = {}): TextPose {
    return { x: 5, y: 7, width: 400, height: 1, text: 'AB', style: STYLE, ...over };
  }

  it('keeps x, y and width when growing height', () => {
    const fit = fitTextPose(textPose());
    expect(fit.x).toBe(5);
    expect(fit.y).toBe(7);
    expect(fit.width).toBe(400);
    expect(fit.height).toBe(LINE);
  });

  it('grows height to fit wrapped content', () => {
    // 'AB AB' is 44 + 8 + 44 = 96 unwrapped; at width 60 it wraps to 2 lines.
    const fit = fitTextPose(textPose({ width: 60, text: 'AB AB' }));
    expect(fit.height).toBe(2 * LINE);
  });

  it('respects vertical padding when growing height', () => {
    const fit = fitTextPose(textPose(), { padding: { y: 4 } });
    expect(fit.height).toBe(LINE + 8);
  });

  it('subtracts horizontal padding from the wrap width', () => {
    // 'AB AB' fits on one line at 96 wide, but not once padding takes 40 of it.
    const wide = fitTextPose(textPose({ width: 100, text: 'AB AB' }));
    expect(wide.height).toBe(LINE);
    const padded = fitTextPose(textPose({ width: 100, text: 'AB AB' }), { padding: { x: 20 } });
    expect(padded.height).toBe(2 * LINE);
  });

  it('axis=both fits to the longest line and ignores the pose width', () => {
    const fit = fitTextPose(textPose({ width: 9, text: 'A\nAB\nB' }), { axis: 'both' });
    // 'AB' is the longest: 23 + 22 - 1 kern = 44.
    expect(fit.width).toBe(44);
    expect(fit.height).toBe(3 * LINE);
  });

  it('axis=both adds padding on both axes', () => {
    const fit = fitTextPose(textPose({ text: 'AB' }), { axis: 'both', padding: 6 });
    expect(fit.width).toBe(44 + 12);
    expect(fit.height).toBe(LINE + 12);
  });

  it('sizes by the kerned width, not the sum of the advances', () => {
    // The regression the 10px-per-char stub could never show: summing per
    // character gives 23 + 22 = 45, and the painted line is 44.
    const fit = fitTextPose(textPose({ text: 'AB' }), { axis: 'both' });
    expect(fit.width).toBe(44);
  });

  it('measures per-run sizes, which the pose-level style alone cannot', () => {
    // A second run at double the size is twice as wide; the old path read
    // `pose.text` and the node style only, so both runs measured at 32.
    const plain = fitTextPose(textPose({ text: 'AB' }), { axis: 'both' });
    const mixed = fitTextPose(
      textPose({ text: 'AB', runs: [{ text: 'A' }, { text: 'B', fontSize: SIZE * 2 }] }),
      { axis: 'both' },
    );
    // 'B' doubles from 22 to 44, so the line is 22 wider than the plain one.
    expect(plain.width).toBe(44);
    expect(mixed.width).toBe(66);
  });
});
