import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { layoutRuns, type LayoutRunsOpts } from './layoutRuns';
import type { ResolvedRun } from '../runs/resolveRuns';

// FIXTURE_FONT at fontSize 32 (scale 1) — A 23, B 22, A→B kerning -1, space
// fontSize * 0.25 = 8 — plus a hyphen and '!' of 10 and two ideographs of 20.
const glyph = (id: number, xadvance: number) =>
  ({ id, x: 0, y: 0, width: xadvance, height: 28, xoffset: 0, yoffset: 4, xadvance, page: 0 });
const FONT = {
  ...FIXTURE_FONT,
  chars: [...FIXTURE_FONT.chars, glyph(0x2d, 10), glyph(0x21, 10), glyph(0x6f22, 20), glyph(0x5b57, 20)],
};

beforeEach(async () => {
  _resetFontRegistryForTests();
  global.fetch = vi.fn().mockImplementation((url: string) => (url.endsWith('.json')
    ? Promise.resolve({ ok: true, json: () => Promise.resolve(FONT) })
    : Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(['PNG'])) }))) as typeof fetch;
  global.createImageBitmap = vi.fn().mockResolvedValue({
    width: 512, height: 512, close: vi.fn(),
  } as unknown as ImageBitmap);
  await registerFont('inter', {}, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
});

const RUN = (text: string): ResolvedRun => ({
  text, fontFamily: 'inter', fontSize: 32, fontWeight: 400, fontStyle: 'normal',
  fill: { fill: 'solid', color: '#000' }, letterSpacing: 0,
  underline: false, strikethrough: false, overline: false, baselineShift: 0,
});

/** Each line's text, from its cells. */
function lineTexts(text: string, opts: Omit<LayoutRunsOpts, 'align'>): string[] {
  return layoutRuns([RUN(text)], { align: 'left', ...opts }).lines.map((l) => String.fromCodePoint(...l.cells.map((c) => c.cp)));
}

describe('layoutRuns — wrap at UAX #14 break opportunities', () => {
  it('breaks after a hyphen', () => {
    // 'AB-' is 54; a third 'AB' would reach 152.
    expect(lineTexts('AB-AB-AB', { maxWidth: 120, lineHeight: 1.2 })).toEqual(['AB-AB-', 'AB']);
  });

  it('breaks between ideographs', () => {
    expect(lineTexts('漢字漢字漢', { maxWidth: 50, lineHeight: 1.2 })).toEqual(['漢字', '漢字', '漢']);
  });

  it('keeps a space-separated mark with the word before it', () => {
    // No line may start with '!', so 'AB !' moves down whole: 52 + 62 > 100.
    expect(lineTexts('AB AB !', { maxWidth: 100, lineHeight: 1.2 })).toEqual(['AB ', 'AB !']);
  });

  it('never breaks inside a word, even one wider than the line', () => {
    expect(lineTexts('ABABAB AB', { maxWidth: 50, lineHeight: 1.2 })).toEqual(['ABABAB ', 'AB']);
  });
});
