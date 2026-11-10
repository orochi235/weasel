/**
 * Round trips of the inline run grammar: runs written and read back keep their text and every flag the
 * grammar can spell, under the markdown subset and a grammar with a two-character marker beside it.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { MARKDOWN_RUN_GRAMMAR, markdownToRuns, runsToMarkdown, runsToPlainText, type RunFlag, type RunGrammar, type StyledRun } from './runs';
import { mixedText, runs, tally } from './pbt.fixture';

const RUNS = 400;

const STRUCK: RunGrammar = {
  markers: [...MARKDOWN_RUN_GRAMMAR.markers, { delimiter: '~', repeat: 2, flags: ['strikethrough'] }, { delimiter: '_', repeat: 1, flags: ['underline'] }],
};

const GRAMMARS: [string, RunGrammar, readonly RunFlag[]][] = [
  ['markdown', MARKDOWN_RUN_GRAMMAR, ['bold', 'italic']],
  ['with ~~ and _', STRUCK, ['bold', 'italic', 'strikethrough', 'underline']],
];

/** Text dense in the grammars' delimiters and the backslash. */
const delimited = fc.array(fc.oneof(
  { weight: 3, arbitrary: fc.constantFrom('*', '**', '\\', '~', '_', '\\*', 'a', ' ') },
  { weight: 1, arbitrary: mixedText(3) },
), { maxLength: 8 }).map((a) => a.join(''));

const styled = fc.array(fc.record({
  text: fc.oneof(delimited, mixedText(4)),
  bold: fc.boolean(), italic: fc.boolean(), underline: fc.boolean(), strikethrough: fc.boolean(), overline: fc.boolean(),
}), { maxLength: 6 }).map((rs) => rs.map(({ text, ...flags }): StyledRun => {
  const run: StyledRun = { text };
  for (const [k, v] of Object.entries(flags)) if (v) (run as unknown as Record<string, boolean>)[k] = true;
  return run;
}));

/** Per UTF-16 unit, which of `flags` it carries. */
function perUnit(rs: readonly StyledRun[], flags: readonly RunFlag[]): string[] {
  const out: string[] = [];
  for (const r of rs) {
    const on = flags.filter((f) => r[f]).join('+');
    for (let k = 0; k < r.text.length; k++) out.push(on);
  }
  return out;
}

describe('run grammar, property', () => {
  for (const [name, grammar, flags] of GRAMMARS) {
    it(`reads back what it writes, text and flags, in ${name}`, () => {
      const t = tally();
      fc.assert(fc.property(styled, (rs) => {
        const md = runsToMarkdown(rs, grammar);
        const back = markdownToRuns(md, grammar);
        expect(runsToPlainText(back), md).toBe(runsToPlainText(rs));
        expect(perUnit(back, flags), md).toEqual(perUnit(rs, flags));
        for (const r of back) expect(r.text.length).toBeGreaterThan(0);
        if (new Set(perUnit(rs, flags)).size > 2) t.count('mixed');
      }), runs(RUNS));
      t.atLeast('mixed', 50);
    });

    it(`settles any input after one read in ${name}`, () => {
      fc.assert(fc.property(delimited, (md) => {
        const once = markdownToRuns(md, grammar);
        const again = markdownToRuns(runsToMarkdown(once, grammar), grammar);
        expect(runsToPlainText(again)).toBe(runsToPlainText(once));
        expect(perUnit(again, flags)).toEqual(perUnit(once, flags));
      }), runs(RUNS));
    });
  }
});
