import { describe, it, expect } from 'vitest';
import { scriptPieces, SCRIPT_NAMES } from './scripts';

/** Each piece as its text and direction. */
const cut = (text: string) =>
  scriptPieces(text).map(({ start, end, rtl }) => [text.slice(start, end), rtl ? 'rtl' : 'ltr']);

describe('scriptPieces', () => {
  it('cuts Latin from Arabic, each in its own direction', () => {
    expect(cut('abc بيت')).toEqual([['abc ', 'ltr'], ['بيت', 'rtl']]);
  });

  it('cuts between two scripts no list names', () => {
    // Cherokee, then Tifinagh.
    expect(cut('ᏣᎳᎩⵜⴰⵎ')).toEqual([['ᏣᎳᎩ', 'ltr'], ['ⵜⴰⵎ', 'ltr']]);
  });

  it('takes each piece\'s direction from its own letters', () => {
    // Samaritan reads right to left and Cherokee left to right.
    expect(cut('ࠀࠁᏣᎳ')).toEqual([['ࠀࠁ', 'rtl'], ['ᏣᎳ', 'ltr']]);
  });

  it('gives a closing bracket the script of its opening one', () => {
    expect(cut('abc (שלום) def')).toEqual([['abc (', 'ltr'], ['שלום', 'rtl'], [') def', 'ltr']]);
  });

  it('pairs brackets that open before any letter once a letter arrives', () => {
    expect(cut('(abc שלום) x')).toEqual([['(abc ', 'ltr'], ['שלום', 'rtl'], [') x', 'ltr']]);
  });

  it('leaves an unmatched closing bracket with the piece before it', () => {
    expect(cut('שלום) x')).toEqual([['שלום) ', 'rtl'], ['x', 'ltr']]);
  });

  it('puts shared characters that open the text in the piece after them, and marks with their base', () => {
    expect(cut('12 بَ')).toEqual([['12 بَ', 'rtl']]);
  });

  it('keeps private-use and unassigned characters in the piece around them', () => {
    expect(cut('ab')).toEqual([['ab', 'ltr']]);
  });

  it('measures pieces in UTF-16 units across astral characters', () => {
    // Adlam is astral and right to left.
    const text = 'a𞤀𞤁b';
    expect(scriptPieces(text)).toEqual([
      { start: 0, end: 1, rtl: false },
      { start: 1, end: 5, rtl: true },
      { start: 5, end: 6, rtl: false },
    ]);
  });

  it('gives empty text no pieces, and all-shared text one', () => {
    expect(scriptPieces('')).toEqual([]);
    expect(cut('12, 34')).toEqual([['12, 34', 'ltr']]);
  });

  it('names every script this runtime knows', () => {
    // A script the list lacks would join its neighbors rather than cut.
    const names = ['Common', 'Inherited', 'Unknown', ...SCRIPT_NAMES].flatMap((name) => {
      try {
        return [new RegExp(`\\p{Script=${name}}`, 'u').source];
      } catch {
        return [];
      }
    });
    const named = new RegExp(`[${names.join('')}]`, 'u');
    const unnamed: string[] = [];
    for (let cp = 0; cp <= 0x10ffff; cp++) {
      if (cp >= 0xd800 && cp <= 0xdfff) continue;
      if (!named.test(String.fromCodePoint(cp))) unnamed.push(cp.toString(16));
    }
    expect(unnamed).toEqual([]);
  });
});
