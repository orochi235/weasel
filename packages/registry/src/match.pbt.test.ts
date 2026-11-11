/**
 * Property tests of `matchQuery` and `hasTag`: a field holding the query matches it, in the query's case or another;
 * a blank query matches everything; text is tried before tags, and the tag reported is the first that matches; and
 * a query no field holds, in any case, matches nothing.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { hasTag, matchQuery } from './match';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 500;

/** Letters whose upper and lower case map one to one, final sigma aside, and a few that don't. */
const caseLetter = fc.constantFrom('a', 'B', 'z', 'Σ', 'σ', 'ς', 'α', 'Ω', 'Ж', 'é', ' ', '-');
const oddLetter = fc.constantFrom('İ', 'ß', 'ﬁ', '😀', '̇');
const word = (letter: fc.Arbitrary<string>, min = 0) => fc.array(letter, { minLength: min, maxLength: 4 }).map((cs) => cs.join(''));
const anyWord = word(fc.oneof({ weight: 4, arbitrary: caseLetter }, { weight: 1, arbitrary: oddLetter }));
const flip = (s: string, how: number) => (how === 0 ? s : how === 1 ? s.toUpperCase() : s.toLowerCase());

describe('matchQuery', () => {
  it('matches a text field holding the query, in its case or another', () => {
    const t = tally();
    fc.assert(fc.property(anyWord, word(caseLetter, 1), anyWord, fc.integer({ min: 0, max: 2 }), fc.array(anyWord, { maxLength: 2 }),
      (pre, q, post, how, others) => {
        if (q.trim() === '') return;
        const text = `${pre}${flip(q, how)}${post}`;
        expect(matchQuery(q, { text: [...others, undefined, text] })).toEqual({ by: 'text' });
        t.count(/[Σσς]/.test(q) ? 'sigma' : 'other');
      }), runs(RUNS));
    t.atLeast('sigma', RUNS / 10);
    t.atLeast('other', RUNS / 10);
  }, timeoutFor(RUNS, 1));

  it('matches a field holding the query exactly, whatever its letters', () => {
    fc.assert(fc.property(anyWord, anyWord, anyWord, (pre, q, post) => {
      expect(matchQuery(q, { text: [`${pre}${q}${post}`] })).toEqual({ by: 'text' });
      expect(matchQuery(`  ${q}\t`, { text: [], tags: ['', `${pre}${q}${post}`] })).toEqual(q.trim() === '' ? { by: 'text' } : { by: 'tag', tag: `${pre}${q}${post}` });
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));

  it('reports text before tags, then the first matching tag, and null when nothing holds the query', () => {
    const t = tally();
    const lower = (s: string) => s.toLowerCase();
    const ascii = word(fc.constantFrom('a', 'b', 'A', 'B', 'c'));
    fc.assert(fc.property(word(fc.constantFrom('a', 'b', 'A', 'B'), 1), fc.array(fc.option(ascii, { nil: undefined }), { maxLength: 3 }), fc.option(fc.array(ascii, { maxLength: 3 }), { nil: undefined }),
      (q, text, tags) => {
        const got = matchQuery(q, { text, tags });
        const byText = text.some((x) => x !== undefined && lower(x).includes(lower(q)));
        const tag = tags?.find((x) => lower(x).includes(lower(q)));
        expect(got).toEqual(byText ? { by: 'text' } : tag !== undefined ? { by: 'tag', tag } : null);
        t.count(got === null ? 'none' : got.by);
      }), runs(RUNS));
    t.atLeast('text', RUNS / 10);
    t.atLeast('tag', RUNS / 20);
    t.atLeast('none', RUNS / 10);
  }, timeoutFor(RUNS, 1));

  it('matches everything on a blank query', () => {
    fc.assert(fc.property(fc.stringMatching(/^[ \t\n  ]*$/), fc.array(anyWord, { maxLength: 2 }), (q, text) => {
      expect(matchQuery(q, { text })).toEqual({ by: 'text' });
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});

describe('hasTag', () => {
  it('is true exactly when a tag equals the one asked for', () => {
    fc.assert(fc.property(fc.option(fc.array(anyWord, { maxLength: 3 }), { nil: undefined }), anyWord, (tags, tag) => {
      expect(hasTag(tags, tag)).toBe(tags?.some((x) => x === tag) ?? false);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});

describe('matchQuery, shrunk', () => {
  it('finds a capital sigma at the end of a word, which lowercases to final sigma', () => {
    expect(matchQuery('Σ', { text: ['ΑΣ'] })).toEqual({ by: 'text' });
    expect(matchQuery('ς', { text: ['σ'] })).toEqual({ by: 'text' });
  });
});
