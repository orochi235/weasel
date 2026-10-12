import { describe, expect, it } from 'vitest';
import type { StyledRun } from '@weasel-js/text';
import { replaceRunRange, runStyleAt } from './runSplice';

const RUNS: StyledRun[] = [{ text: 'ab', bold: true }, { text: 'cd' }, { text: 'ef', italic: true }];
const X: StyledRun[] = [{ text: 'X', underline: true }];

describe('replaceRunRange', () => {
  it('inserts at a caret, splitting the run that spans it', () => {
    expect(replaceRunRange(RUNS, 1, 1, X)).toEqual([
      { text: 'a', bold: true }, { text: 'X', underline: true }, { text: 'b', bold: true }, { text: 'cd' },
      { text: 'ef', italic: true },
    ]);
  });

  it('inserts between two runs, and at either end', () => {
    expect(replaceRunRange(RUNS, 2, 2, X).map((r) => r.text)).toEqual(['ab', 'X', 'cd', 'ef']);
    expect(replaceRunRange(RUNS, 0, 0, X).map((r) => r.text)).toEqual(['X', 'ab', 'cd', 'ef']);
    expect(replaceRunRange(RUNS, 6, 6, X).map((r) => r.text)).toEqual(['ab', 'cd', 'ef', 'X']);
    expect(replaceRunRange([], 0, 0, X)).toEqual(X);
  });

  it('replaces a range across runs, dropping the ones inside it', () => {
    expect(replaceRunRange(RUNS, 1, 5, X)).toEqual([
      { text: 'a', bold: true }, { text: 'X', underline: true }, { text: 'f', italic: true },
    ]);
    expect(replaceRunRange(RUNS, 0, 6, X)).toEqual(X);
  });

  it('deletes a range given nothing to insert, merging what closes up', () => {
    expect(replaceRunRange([{ text: 'ab' }, { text: 'X', bold: true }, { text: 'cd' }], 2, 3, [])).toEqual([{ text: 'abcd' }]);
  });

  it('leaves its arguments alone', () => {
    const before = JSON.stringify([RUNS, X]);
    replaceRunRange(RUNS, 1, 5, X);
    expect(JSON.stringify([RUNS, X])).toBe(before);
  });
});

describe('runStyleAt', () => {
  it('is the style of the run to the left, and of the first run at the start', () => {
    expect(runStyleAt(RUNS, 0)).toEqual({ bold: true });
    expect(runStyleAt(RUNS, 2)).toEqual({ bold: true });
    expect(runStyleAt(RUNS, 3)).toEqual({});
    expect(runStyleAt(RUNS, 5)).toEqual({ italic: true });
    expect(runStyleAt(RUNS, 99)).toEqual({ italic: true });
    expect(runStyleAt([], 0)).toEqual({});
  });
});
