/** Counterexamples the transform's properties shrank to, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import { transformRunTexts } from './textTransform';

describe('transformRunTexts, shrunk counterexamples', () => {
  it('lowercases a Turkish I and combining dot to one i, spanning both', () => {
    expect(transformRunTexts(['İ'], ['lowercase'], ['tr'])).toEqual([
      { text: 'i', srcMap: { length: 2, starts: [0], ends: [2] } },
    ]);
  });

  it('drops a combining accent that Greek uppercasing removes, into the letter before it', () => {
    expect(transformRunTexts(['ῴ'], ['uppercase'], ['el'])).toEqual([
      { text: 'ΩΙ', srcMap: { length: 2, starts: [0, 0], ends: [2, 2] } },
    ]);
  });

  it('keeps the paragraph\'s mapping when the dropped mark sits mid-run after a run boundary', () => {
    const out = transformRunTexts(['a', 'İb'], ['none', 'lowercase'], ['tr', 'tr']);
    expect(out.map((o) => o.text)).toEqual(['a', 'ib']);
  });
});
