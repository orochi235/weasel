import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerCanvasFont } from '@weasel-js/font';
import {
  _resetFontRegistryForTests, _resetFallbackForTests, _resetDynamicFontsForTests, __setGlyphRasterizerForTests,
} from '@weasel-js/font/test-seams';
import { layoutRuns } from './layoutRuns';
import type { ResolvedRun } from '../runs/resolveRuns';

const UNASSIGNED = 0xe000;
const INKLESS = new Set([0xfe0f, 0x200d, 0x200c, 0x200b, UNASSIGNED]);

beforeEach(() => {
  _resetFontRegistryForTests();
  _resetFallbackForTests();
  _resetDynamicFontsForTests();
  __setGlyphRasterizerForTests({
    faceMetrics: () => ({ ascent: 40, descent: 8 }),
    rasterize: (_f, _w, _s, cp) => (INKLESS.has(cp)
      ? { width: 0, height: 0, alpha: new Uint8ClampedArray(0), left: 0, top: 0, advance: 0 }
      : { width: 20, height: 24, alpha: new Uint8ClampedArray(20 * 24).fill(255), left: -8, top: 26, advance: 22 }),
  });
  registerCanvasFont('Dyn');
});
afterEach(() => vi.restoreAllMocks());

// Bake size 48, so an advance of 22 is 11 world units.
const run = (text: string): ResolvedRun => ({
  text, fontFamily: 'Dyn', fontWeight: 400, fontStyle: 'normal', fontSize: 24,
  fill: { paint: { kind: 'solid', color: '#000' } }, letterSpacing: 4,
  underline: false, strikethrough: false, overline: false, baselineShift: 0,
});
const cellsOf = (text: string) =>
  layoutRuns([run(text)], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' }).lines[0].cells;

describe('a canvas-font cluster closed by a zero-width code point', () => {
  it.each([
    ['a variation selector', '\u2600\ufe0fB', 15],
    ['a zero-width joiner', 'A\u200dB', 15],
    ['a zero-width non-joiner', 'A\u200cB', 15],
    // A cluster of its own, so it is tracked as one.
    ['a zero-width space', 'A\u200bB', 19],
  ])('keeps its letter spacing after %s, and does not call it a missing glyph', (_name, text, lastX) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cells = cellsOf(text);
    expect(cells[cells.length - 1].x - cells[0].x).toBeCloseTo(lastX);
    expect(warn).not.toHaveBeenCalled();
  });

  it('still drops the slot, and warns, for a code point the face has no glyph for', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cells = cellsOf('A\ue000B');
    expect(cells.map((c) => [c.x, c.drawsInk])).toEqual([[0, true], [15, false], [15, true]]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('U+E000');
  });
});
