/**
 * Property tests of the DTCG interchange path: a theme written by `toDtcg`, through JSON, and read back by
 * `fromDtcg` over the same parent resolves as the original does at every selection, failures included.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { enumerateAxisChoices } from '../../axes';
import { fromDtcg, type DtcgDocument } from '../../fromDtcg';
import { chainTheme, outcome, runs, tally, timeoutFor } from '../../pbt.fixture';
import { resolveTheme, themeAxes } from '../../resolveTheme';
import { toDtcg } from './dtcg';

const RUNS = 300;

describe('toDtcg and fromDtcg', () => {
  it('a theme read back resolves as it did, at every selection', () => {
    const t = tally();
    fc.assert(
      fc.property(chainTheme, (theme) => {
        const doc = JSON.parse(JSON.stringify(toDtcg(theme))) as DtcgDocument;
        const back = fromDtcg({ ...doc, extends: theme.extends });
        expect(back.name).toBe(theme.name);
        for (const sel of enumerateAxisChoices(themeAxes(theme))) {
          const want = outcome(() => resolveTheme(theme, sel));
          const got = outcome(() => resolveTheme(back, sel));
          t.count(typeof want === 'string' ? 'fails' : 'resolves');
          if (theme.extends) t.count('chain');
          if (Object.keys(themeAxes(theme)).length > 1) t.count('two axes');
          if (typeof want === 'string') expect(typeof got).toBe('string');
          else expect(got).toEqual(want);
        }
      }),
      runs(RUNS),
    );
    t.atLeast('resolves', 100);
    t.atLeast('fails', 50);
    t.atLeast('chain', 200);
    t.atLeast('two axes', 200);
  }, timeoutFor(RUNS, 20));

  // Not the first document: a `by` naming none of its axis' values writes an empty override layer, which reads back as nothing.
  it('a document read back and written again is unchanged from then on', () => {
    const write = (doc: DtcgDocument, parent: DtcgDocument['extends']) => JSON.parse(JSON.stringify(toDtcg(fromDtcg({ ...doc, extends: parent })))) as DtcgDocument;
    fc.assert(
      fc.property(chainTheme, (theme) => {
        const once = write(JSON.parse(JSON.stringify(toDtcg(theme))) as DtcgDocument, theme.extends);
        expect(write(once, theme.extends)).toEqual(once);
      }),
      runs(RUNS),
    );
  }, timeoutFor(RUNS, 10));
});
