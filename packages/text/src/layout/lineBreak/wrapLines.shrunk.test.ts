/** Counterexamples the wrap's properties shrank to, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import { wrapLines } from './wrapLines';

const cps = (text: string): number[] => [...text].map((c) => c.codePointAt(0)!);
const tens = (start: number, end: number): number => (end - start) * 10;

describe('wrapLines, shrunk counterexamples', () => {
  it('keeps a paragraph\'s opening spaces with what no line may start with', () => {
    // No opportunity before `!` or `。`, so neither may open a line after the spaces.
    expect(wrapLines(cps(' !'), 5, tens)).toEqual([{ start: 0, end: 2, wrapped: false }]);
    expect(wrapLines(cps('\n  。'), 1, tens)).toEqual([
      { start: 0, end: 0, wrapped: false },
      { start: 1, end: 4, wrapped: false },
    ]);
  });

  it('wraps before a tab after a zero-width space when what follows the tab is ink', () => {
    // The opportunity is before the tab: none falls between it and the `!`.
    expect(wrapLines(cps('\u200b\t!'), 1, tens)).toEqual([
      { start: 0, end: 1, wrapped: true },
      { start: 1, end: 3, wrapped: false },
    ]);
  });

  it('wraps before a tab carrying a mark, which is ink and does not hang', () => {
    expect(wrapLines(cps('A A  \t\u0301'), 10, (s, e) => cps('A A  \t\u0301').slice(s, e).reduce((w, c) => w + (c === 32 || c === 9 ? 8 : 1), 0))).toEqual([
      { start: 0, end: 5, wrapped: true },
      { start: 5, end: 7, wrapped: false },
    ]);
  });

  it('still wraps after opening spaces where a line may break', () => {
    expect(wrapLines(cps(' AB'), 5, tens)).toEqual([
      { start: 0, end: 1, wrapped: true },
      { start: 1, end: 3, wrapped: false },
    ]);
  });
});
