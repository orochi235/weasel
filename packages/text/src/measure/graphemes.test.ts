import { describe, it, expect } from 'vitest';
import { graphemeEnds } from './graphemes';

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const wholeText = (text: string): number[] => [...segmenter.segment(text)].map((s) => s.index + s.segment.length);

/** Units that join, or sit beside something that joins: marks, CR and LF, a
 *  prepended mark, ZWJ emoji opening on ©, flags, Hangul jamo, a soft hyphen. */
const PIECES = [
  'a', 'e', ' ', '1', '\r', '\n', 'é', '©', '®', '­', '́', '̈', '‍',
  '؀', 'क', '्', 'ष', 'ᄀ', 'ᅡ', 'ᆨ', '👍', '🏽',
  '🇺', '🇸', '️', '❤',
];

describe('graphemeEnds', () => {
  it('splits plain text one unit a cluster', () => {
    expect(graphemeEnds('L0001 3.40')).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('agrees with segmenting the whole text, asking only about the stretches that need it', () => {
    let seed = 7;
    const next = (k: number) => { seed = (seed * 1103515245 + 12345) >>> 0; return seed % k; };
    for (let t = 0; t < 2000; t++) {
      let text = '';
      const pieces = 1 + next(12);
      for (let p = 0; p < pieces; p++) text += PIECES[next(PIECES.length)];
      expect(graphemeEnds(text), JSON.stringify(text)).toEqual(wholeText(text));
    }
  });

  it('refills the array it is handed', () => {
    const into = [9, 9, 9, 9, 9, 9, 9, 9];
    expect(graphemeEnds('café', into)).toBe(into);
    expect(into).toEqual([1, 2, 3, 5]);
  });
});
