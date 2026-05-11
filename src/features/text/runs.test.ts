import { describe, it, expect } from 'vitest';
import { toRuns, runsToPlainText, runsToMarkdown, type StyledRun } from './runs';

describe('toRuns', () => {
  it('wraps a string into a single run', () => {
    expect(toRuns('hello')).toEqual([{ text: 'hello' }]);
  });

  it('preserves newlines in the string form', () => {
    expect(toRuns('a\nb')).toEqual([{ text: 'a\nb' }]);
  });

  it('returns an empty array for an empty string', () => {
    expect(toRuns('')).toEqual([]);
  });

  it('passes an existing StyledRun[] through unchanged', () => {
    const runs: StyledRun[] = [
      { text: 'a' },
      { text: 'b', bold: true },
      { text: 'c', italic: true, fontSize: 20 },
    ];
    expect(toRuns(runs)).toEqual(runs);
  });

  it('throws when a run lacks a string text field', () => {
    expect(() => toRuns([{ text: 42 } as unknown as StyledRun])).toThrow(/text/);
  });
});

describe('runsToPlainText', () => {
  it('concatenates run text fields', () => {
    expect(runsToPlainText([{ text: 'a' }, { text: 'b', bold: true }])).toBe('ab');
  });

  it('returns empty string for empty array', () => {
    expect(runsToPlainText([])).toBe('');
  });

  it('preserves embedded newlines', () => {
    expect(runsToPlainText([{ text: 'a\n', bold: true }, { text: 'b' }])).toBe('a\nb');
  });
});

describe('runsToMarkdown', () => {
  it('returns plain text unchanged when no run is styled', () => {
    expect(runsToMarkdown([{ text: 'hello world' }])).toBe('hello world');
  });

  it('wraps a bold run in **', () => {
    expect(runsToMarkdown([{ text: 'bold', bold: true }])).toBe('**bold**');
  });

  it('wraps an italic run in *', () => {
    expect(runsToMarkdown([{ text: 'em', italic: true }])).toBe('*em*');
  });

  it('wraps a bold-italic run in ***', () => {
    expect(runsToMarkdown([{ text: 'both', bold: true, italic: true }])).toBe('***both***');
  });

  it('joins adjacent runs without separators', () => {
    expect(
      runsToMarkdown([
        { text: 'a ' },
        { text: 'b', bold: true },
        { text: ' c' },
      ]),
    ).toBe('a **b** c');
  });

  it('escapes literal asterisks in plain text', () => {
    expect(runsToMarkdown([{ text: 'a*b' }])).toBe('a\\*b');
  });

  it('escapes literal backslashes in plain text', () => {
    expect(runsToMarkdown([{ text: 'a\\b' }])).toBe('a\\\\b');
  });
});
