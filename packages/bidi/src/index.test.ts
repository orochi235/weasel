import { describe, it, expect } from 'vitest';
import { bidi, analyze, reorder, mirror, BIDI_UNICODE_VERSION } from './index';

/** Hebrew alef-bet-gimel, a space, and Latin digits. */
const HE = [0x05d0, 0x05d1, 0x05d2];
const cps = (s: string) => [...s].map((c) => c.codePointAt(0)!);

describe('the public seam', () => {
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
    expect(mirror(0x28)).toBe(0x29);
    expect(mirror(0x41)).toBe(null);
  });

  it('exposes the same three calls on the default engine', () => {
    expect(typeof bidi.analyze).toBe('function');
    expect(typeof bidi.reorder).toBe('function');
    expect(typeof bidi.mirror).toBe('function');
  });

  it('reports the Unicode version its tables came from', () => {
    expect(BIDI_UNICODE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
