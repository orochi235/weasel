import { describe, expect, it } from 'vitest';
import { applyStyleToRange, styleAtRange } from './rangeStyle';
import { setFlagOverRange } from './flagRange';
import { rejoinSplitPairs } from './codePointCuts';

// 'a', then U+1F1EB and U+1F1F7 (the French flag), each a surrogate pair.
const FLAG = 'a\u{1f1eb}\u{1f1f7}';

describe('range styling never cuts a code point', () => {
  it('widens a range end inside a surrogate pair to the whole character (shrunk counterexample)', () => {
    expect(applyStyleToRange([{ text: FLAG }], 0, 2, { bold: true })).toEqual([
      { text: 'a\u{1f1eb}', bold: true }, { text: '\u{1f1f7}' },
    ]);
    expect(applyStyleToRange([{ text: FLAG }], 2, 4, { italic: true })).toEqual([
      { text: 'a' }, { text: '\u{1f1eb}\u{1f1f7}', italic: true },
    ]);
    expect(setFlagOverRange([{ text: FLAG }], { underline: true }, 4, 5, 'underline', false).runs).toEqual([
      { text: 'a\u{1f1eb}', underline: true }, { text: '\u{1f1f7}' },
    ]);
  });

  it('reads a range the way it would write it', () => {
    const runs = [{ text: 'a\u{1f1eb}', bold: true }, { text: '\u{1f1f7}' }];
    expect(styleAtRange(runs, 2, 3).bold).toBe(true);
  });

  it('still styles a combining mark alone', () => {
    expect(applyStyleToRange([{ text: 'é' }], 1, 2, { bold: true })).toEqual([
      { text: 'e' }, { text: '́', bold: true },
    ]);
  });
});

describe('rejoinSplitPairs', () => {
  it('moves a split pair into the run holding its high surrogate, past empty runs', () => {
    const runs = [{ text: 'x\ud83d', id: 1 }, { text: '', id: 2 }, { text: '\ude00y', id: 3 }];
    expect(rejoinSplitPairs(runs)).toEqual([
      { text: 'x\u{1f600}', id: 1 }, { text: '', id: 2 }, { text: 'y', id: 3 },
    ]);
  });

  it('returns the same array when no pair is split', () => {
    const runs = [{ text: '\u{1f600}' }, { text: '\ude00' }];
    expect(rejoinSplitPairs(runs)).toBe(runs);
  });

  it('carries the size and source maps along', () => {
    const runs = [
      { text: 'A\ud83d', sizeMap: [10, 12], srcMap: { length: 2, starts: [0, 1], ends: [1, 2] } },
      { text: '\ude00B', sizeMap: [20, 20], srcMap: { length: 2, starts: [0, 1], ends: [1, 2] } },
    ];
    expect(rejoinSplitPairs(runs)).toEqual([
      { text: 'A\u{1f600}', sizeMap: [10, 12, 12], srcMap: { length: 3, starts: [0, 1, 1], ends: [1, 3, 3] } },
      { text: 'B', sizeMap: [20], srcMap: { length: 1, starts: [0], ends: [1] } },
    ]);
  });
});
