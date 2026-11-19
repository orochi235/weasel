import { describe, it, expect } from 'vitest';
import { bidi, analyze, reorder, mirrorOf, paragraphLevel, UNICODE_VERSION } from './index';

/** Hebrew alef-bet-gimel, a space, and Latin digits. */
const HE = [0x05d0, 0x05d1, 0x05d2];
const cps = (s: string) => [...s].map((c) => c.codePointAt(0)!);

describe('the public seam', () => {
  it('reports the level a paragraph reads at', () => {
    expect(paragraphLevel(analyze(cps('abc')))).toBe(0);
    expect(paragraphLevel(analyze(HE))).toBe(1);
    expect(bidi.paragraphLevel(analyze(HE, 'ltr'))).toBe(0);
  });

  it('leaves Latin text in logical order', () => {
    const a = analyze(cps('abc'));
    expect(reorder(a, 0, 3).order).toEqual([0, 1, 2]);
    expect(a.paragraphLevel).toBe(0);
  });

  it('reverses a Hebrew paragraph', () => {
    const a = analyze(HE);
    expect(a.paragraphLevel).toBe(1);
    expect(reorder(a, 0, 3).order).toEqual([2, 1, 0]);
  });

  it('keeps digits reading left to right inside Hebrew', () => {
    // The case that makes bidi more than "reverse if RTL": naive reversal
    // renders 25 as 52, which is a different number.
    const text = [...HE, 0x20, 0x32, 0x35];
    const { order } = reorder(analyze(text), 0, text.length);
    const digits = order.filter((i) => i >= 4);
    expect(digits).toEqual([4, 5]);
  });

  it('mirrors a bracket only where the caller finds an odd level', () => {
    expect(mirrorOf(0x28)).toBe(0x29);
    expect(mirrorOf(0x41)).toBe(null);
  });

  it('exposes the same calls on the default engine', () => {
    expect(bidi.analyze).toBe(analyze);
    expect(bidi.reorder).toBe(reorder);
    expect(bidi.mirror).toBe(mirrorOf);
    expect(bidi.paragraphLevel).toBe(paragraphLevel);
  });

  it('reports the Unicode version its tables came from', () => {
    expect(UNICODE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('a paragraph separator mid-text', () => {
  it('resolves the text after it without the paragraph before it as context', () => {
    // a LF ! b under rtl: '!' opens its own paragraph, between sos R and b,
    // so N2 makes it R at level 1, not L at level 2 by N1 across the LF.
    expect(Array.from(analyze(cps('a\n!b'), 'rtl').levels)).toEqual([2, 1, 1, 2]);
  });

  it('runs W2 from the start of the second paragraph', () => {
    // alef LF $ 1: with the alef out of reach, '$1' is ET EN and W5 joins them.
    const a = analyze([0x627, 0x0a, 0x24, 0x31]);
    expect(Array.from(a.levels)).toEqual([1, 1, 2, 2]);
    expect(reorder(a, 2, 4).order).toEqual([2, 3]);
  });

  it('gives an NSM opening a paragraph the paragraph direction (W1 sos)', () => {
    // a LF combining-acute ! b under rtl: the NSM takes sos R, so '!' sits
    // between R and L and N2 leaves it at level 1. Read as class B, the NSM
    // and '!' would join the neutral run between a and b and become L.
    const a = analyze([0x61, 0x0a, 0x301, 0x21, 0x62], 'rtl');
    expect(a.classes[2]).toBe('R');
    expect(a.levels[3]).toBe(1);
  });

  it('pairs no bracket across a separator (BD16)', () => {
    // a ( b LF ) under rtl: paired, N0 would make ')' L at level 2 from the
    // a before '('. Unpaired, ')' is alone in its paragraph and reads R.
    const a = analyze([0x61, 0x28, 0x62, 0x0a, 0x29], 'rtl');
    expect(a.levels[4]).toBe(1);
  });
});
