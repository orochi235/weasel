/**
 * Property tests of the DTCG interchange path: a theme written by `toDTCG`, through JSON, and read back by
 * `loadDTCG` over the same parent resolves as the original does at every selection, failures included.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { enumerateSelections } from '../../axes';
import { loadDTCG, type DtcgDocument } from '../../loadDTCG';
import { chainTheme, outcome, runs, tally, timeoutFor } from '../../pbt.fixture';
import { resolveTheme, themeAxes } from '../../resolveTheme';
import { toDTCG } from './dtcg';

const RUNS = 300;

describe('toDTCG and loadDTCG', () => {
  it('a theme read back resolves as it did, at every selection', () => {
    const t = tally();
    fc.assert(
      fc.property(chainTheme, (theme) => {
        const doc = JSON.parse(JSON.stringify(toDTCG(theme))) as DtcgDocument;
        const back = loadDTCG({ ...doc, extends: theme.extends });
        expect(back.name).toBe(theme.name);
        for (const sel of enumerateSelections(themeAxes(theme))) {
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
    const write = (doc: DtcgDocument, parent: DtcgDocument['extends']) => JSON.parse(JSON.stringify(toDTCG(loadDTCG({ ...doc, extends: parent })))) as DtcgDocument;
    fc.assert(
      fc.property(chainTheme, (theme) => {
        const once = write(JSON.parse(JSON.stringify(toDTCG(theme))) as DtcgDocument, theme.extends);
        expect(write(once, theme.extends)).toEqual(once);
      }),
      runs(RUNS),
    );
  }, timeoutFor(RUNS, 10));
});
