import { describe, it, expect } from 'vitest';
import {
  toRuns, runsToPlainText, runsToMarkdown, markdownToRuns,
  MARKDOWN_RUN_GRAMMAR, type StyledRun, type RunGrammar,
} from './runs';

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

describe('markdownToRuns', () => {
  it('returns a single plain run for unstyled text', () => {
    expect(markdownToRuns('hello')).toEqual([{ text: 'hello' }]);
  });

  it('parses **bold**', () => {
    expect(markdownToRuns('**bold**')).toEqual([{ text: 'bold', bold: true }]);
  });

  it('parses *italic*', () => {
    expect(markdownToRuns('*italic*')).toEqual([{ text: 'italic', italic: true }]);
  });

  it('parses ***bold italic***', () => {
    expect(markdownToRuns('***both***')).toEqual([{ text: 'both', bold: true, italic: true }]);
  });

  it('parses mixed inline styles', () => {
    expect(markdownToRuns('a **b** c')).toEqual([
      { text: 'a ' },
      { text: 'b', bold: true },
      { text: ' c' },
    ]);
  });

  it('parses bold containing italic', () => {
    expect(markdownToRuns('**a *b* c**')).toEqual([
      { text: 'a ', bold: true },
      { text: 'b', bold: true, italic: true },
      { text: ' c', bold: true },
    ]);
  });

  it('preserves embedded newlines inside a run (does not split)', () => {
    expect(markdownToRuns('a\nb')).toEqual([{ text: 'a\nb' }]);
  });

  it('honors backslash escapes for asterisks', () => {
    expect(markdownToRuns('a\\*b')).toEqual([{ text: 'a*b' }]);
  });

  it('round-trips plain → md → runs → md', () => {
    const md = '**hello** *world*';
    expect(runsToMarkdown(markdownToRuns(md))).toBe(md);
  });
});

describe('custom run grammars', () => {
  /** The two flags the markdown subset has no spelling for. */
  const EXTENDED: RunGrammar = {
    markers: [
      ...MARKDOWN_RUN_GRAMMAR.markers,
      { delimiter: '~', repeat: 2, flags: ['strikethrough'] },
      { delimiter: '_', repeat: 1, flags: ['underline'] },
    ],
  };

  it('reads markers the default grammar has no spelling for', () => {
    expect(markdownToRuns('a ~~b~~ _c_', EXTENDED)).toEqual([
      { text: 'a ' },
      { text: 'b', strikethrough: true },
      { text: ' ' },
      { text: 'c', underline: true },
    ]);
  });

  it('writes them back', () => {
    const runs = [{ text: 'b', strikethrough: true }, { text: 'c', underline: true }];
    expect(runsToMarkdown(runs, EXTENDED)).toBe('~~b~~_c_');
  });

  it('escapes every delimiter the grammar names, not just the default ones', () => {
    // `~` and `_` are literal text under the default grammar and must survive
    // it unescaped; under EXTENDED they are markers and must not.
    expect(runsToMarkdown([{ text: 'a~b_c' }])).toBe('a~b_c');
    expect(runsToMarkdown([{ text: 'a~b_c' }], EXTENDED)).toBe('a\\~b\\_c');
    expect(markdownToRuns('a\\~b\\_c', EXTENDED)).toEqual([{ text: 'a~b_c' }]);
  });

  it('nests markers when no single one spells the whole run', () => {
    // EXTENDED has no one marker for bold + strikethrough.
    expect(runsToMarkdown([{ text: 'x', bold: true, strikethrough: true }], EXTENDED))
      .toBe('**~~x~~**');
  });

  it('drops a flag the grammar cannot spell, keeping the text', () => {
    expect(runsToMarkdown([{ text: 'x', underline: true }])).toBe('x');
  });

  it('round-trips through a grammar that renames the delimiters entirely', () => {
    const shouty: RunGrammar = {
      markers: [{ delimiter: '!', repeat: 1, flags: ['bold'] }],
    };
    expect(markdownToRuns('a !b!', shouty)).toEqual([
      { text: 'a ' },
      { text: 'b', bold: true },
    ]);
    // `*` is ordinary text here, and is left alone in both directions.
    expect(runsToMarkdown([{ text: 'a*b' }], shouty)).toBe('a*b');
  });
});
