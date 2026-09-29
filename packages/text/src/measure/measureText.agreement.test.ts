/**
 * `measureText` (the 2D context's wrap) and `layoutRuns` (the GL tier's),
 * measured with the same advances, must end every line at the same character.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { layoutRuns } from '../layout/layoutRuns';
import type { ResolvedRun } from '../runs/resolveRuns';
import { DEFAULT_TEXT_STYLE } from '../textStyle';
import { measureText } from './measureText';

const PARAGRAPHS: Record<string, string> = {
  hyphenated: 'a well-known, hand-made, state-of-the-art text for every-day, run-of-the-mill use',
  CJK: '漢字仮名交じり文は、漢字と仮名で書く日本語の文章です。「括弧」も句読点も行頭に来ない。',
  'punctuation-heavy': '"Wait—what?!" she said (quietly); then: «no…» [really] {ok} 50% $20/h, e.g. 3.14.',
  'hard-broken': 'one two three four five\r\nsix\u000bseven\u000ceight\u0085nine\rten\n\r\neleven',
  combining: 'café résumé naïve crème brûlée fiancée',
};

const SIZE = 32;
const cps = [...new Set([...Object.values(PARAGRAPHS).join('')].map((c) => c.codePointAt(0)!))];
/** Distinct, deterministic advances; combining marks take none. */
const advanceOf = (cp: number): number =>
  cp === 32 ? 8 : cp >= 0x300 && cp < 0x370 ? 0 : cp > 0x2e80 ? 30 : 9 + (cp % 7) * 2;
const FONT = {
  ...FIXTURE_FONT,
  kernings: [],
  chars: cps.map((id) => ({
    id, x: 0, y: 0, width: advanceOf(id), height: 28, xoffset: 0, yoffset: 4, xadvance: advanceOf(id), page: 0,
  })),
};

/** A 2D context measuring with the atlas's advances, which `layoutRuns` sums at scale 1. */
const ctx = {
  measureText: (s: string) => ({ width: [...s].reduce((w, c) => w + advanceOf(c.codePointAt(0)!), 0) }),
} as unknown as CanvasRenderingContext2D;

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

const canvasLines = (text: string, maxWidth: number, letterSpacing: number): string[] =>
  layoutRuns([{
    text, fontFamily: 'inter', fontSize: SIZE, fontWeight: 400, fontStyle: 'normal',
    fill: { fill: 'solid', color: '#000' }, letterSpacing,
    underline: false, strikethrough: false, overline: false, baselineShift: 0,
  } satisfies ResolvedRun], { align: 'left', maxWidth, lineHeight: 1.2 }).lines
    .map((l) => String.fromCodePoint(...l.cells.map((c) => c.cp)).replace(/ +$/, ''));

const measuredLines = (text: string, maxWidth: number, letterSpacing: number): string[] =>
  measureText(ctx, text, maxWidth, { ...DEFAULT_TEXT_STYLE, fontSize: SIZE, letterSpacing }).lines;

describe('measureText and layoutRuns wrap at the same places', () => {
  for (const [name, text] of Object.entries(PARAGRAPHS)) {
    for (const letterSpacing of [0, 3]) {
      it(`${name}${letterSpacing ? ', tracked' : ''}`, () => {
        for (let maxWidth = 60; maxWidth <= 400; maxWidth += 17) {
          const canvas = canvasLines(text, maxWidth, letterSpacing);
          expect(canvas.length, `wraps at ${maxWidth}`).toBeGreaterThan(1);
          expect(measuredLines(text, maxWidth, letterSpacing), `at ${maxWidth}`).toEqual(canvas);
        }
      });
    }
  }

  it('ends a line at every UAX #14 hard break, CRLF counting once', () => {
    const want = ['one two', 'three four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', '', 'eleven'];
    const text = PARAGRAPHS['hard-broken'];
    expect(canvasLines(text, Infinity, 0)).toEqual(want);
    expect(measuredLines(text, Infinity, 0)).toEqual(want);
  });
});
