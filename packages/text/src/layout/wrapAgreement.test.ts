/**
 * The two wrapping layouts — `layoutRuns` for the GL tier and `layoutMarkdown`
 * for the 2D markdown renderer — measured with the same advances must end
 * every line at the same character.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { layoutRuns } from './layoutRuns';
import { layoutMarkdown, type MeasureFn } from '../markdownText';
import type { ResolvedRun } from '../runs/resolveRuns';

const PARAGRAPHS: Record<string, string> = {
  hyphenated: 'a well-known, hand-made, state-of-the-art text for every-day, run-of-the-mill use',
  CJK: '漢字仮名交じり文は、漢字と仮名で書く日本語の文章です。「括弧」も句読点も行頭に来ない。',
  'punctuation-heavy': '"Wait—what?!" she said (quietly); then: «no…» [really] {ok} 50% $20/h, e.g. 3.14.',
  'hard-broken': 'one two\u2028three four\u2029five\r\nsix\u000bseven\u000ceight\u0085nine\rten\n\r\neleven',
};

const SIZE = 32;
const cps = [...new Set([...Object.values(PARAGRAPHS).join('')].map((c) => c.codePointAt(0)!))];
/** Distinct, deterministic advances; the fixture's A→B kerning is never exercised. */
const advanceOf = (cp: number): number => (cp === 32 ? 8 : cp > 0x2e80 ? 30 : 9 + (cp % 7) * 2);
const FONT = {
  ...FIXTURE_FONT,
  chars: cps.map((id) => ({
    id, x: 0, y: 0, width: advanceOf(id), height: 28, xoffset: 0, yoffset: 4, xadvance: advanceOf(id), page: 0,
  })),
};

/** The atlas's advances, which is what `layoutRuns` sums at scale 1. */
const measure: MeasureFn = (text) => [...text].reduce((w, c) => w + advanceOf(c.codePointAt(0)!), 0);

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
  text, fontFamily: 'inter', fontSize: SIZE, fontWeight: 400, fontStyle: 'normal',
  fill: { fill: 'solid', color: '#000' }, letterSpacing: 0,
  underline: false, strikethrough: false, overline: false, baselineShift: 0,
});

/** Split into runs every `step` code points, so words cross run boundaries. */
const pieces = (text: string, step: number): string[] => {
  const chars = [...text];
  const out: string[] = [];
  for (let i = 0; i < chars.length; i += step) out.push(chars.slice(i, i + step).join(''));
  return out;
};

const canvasLines = (texts: string[], maxWidth: number): string[] =>
  layoutRuns(texts.map(RUN), { align: 'left', maxWidth, lineHeight: 1.2 }).lines
    .map((l) => String.fromCodePoint(...l.cells.map((c) => c.cp)).replace(/ +$/, ''));

const markdownLines = (texts: string[], maxWidth: number): string[] =>
  layoutMarkdown(texts.map((text) => ({ text })), maxWidth, SIZE, measure).lines
    .map((l) => l.runs.map((r) => r.text).join('').replace(/ +$/, ''));

describe('layoutMarkdown and layoutRuns wrap at the same places', () => {
  for (const [name, text] of Object.entries(PARAGRAPHS)) {
    for (const split of [0, 5]) {
      it(`${name}${split ? `, split into runs of ${split}` : ''}`, () => {
        const texts = split ? pieces(text, split) : [text];
        for (let maxWidth = 60; maxWidth <= 400; maxWidth += 17) {
          const canvas = canvasLines(texts, maxWidth);
          expect(canvas.length, `wraps at ${maxWidth}`).toBeGreaterThan(1);
          expect(markdownLines(texts, maxWidth), `at ${maxWidth}`).toEqual(canvas);
        }
      });
    }
  }

  it('ends a line at every UAX #14 hard break, CRLF counting once', () => {
    const want = ['one two', 'three four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', '', 'eleven'];
    const texts = [PARAGRAPHS['hard-broken']];
    expect(canvasLines(texts, Infinity)).toEqual(want);
    expect(markdownLines(texts, Infinity)).toEqual(want);
  });
});
