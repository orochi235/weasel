/**
 * Property tests of the letters a menu is found by, written composed or decomposed: an access letter declared
 * either way is chosen by the key that types it, and typeahead lands on a label spelled either way, as it does on
 * the same label composed. Keys are what a keyboard sends: one composed character, in either case.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { accessMatch } from './access';
import type { MenuEntry } from './entries';
import { typeaheadMatch } from './typeahead';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 300;
const run = () => {};
/** Letters with a precomposed form, and plain ones beside them. */
const LETTERS = ['é', 'É', 'e', 'E', 'ä', 'a', 'Å', 'ñ', 'ǟ', 'ṩ', 'ő', 'ь', 'й', 'Ω', 'ώ', 'x'] as const;
const letter = fc.constantFrom(...LETTERS);
const form = fc.constantFrom<'NFC' | 'NFD'>('NFC', 'NFD');
const flip = (s: string, up: boolean) => (up ? s.toUpperCase() : s.toLowerCase());

describe('accessMatch, composed or decomposed', () => {
  it('chooses the row whose letter the key types, however the letter was declared', () => {
    const t = tally();
    const declared = fc.array(fc.tuple(fc.option(letter, { nil: undefined }), form), { minLength: 1, maxLength: 6 });
    fc.assert(fc.property(declared, letter, fc.boolean(), (rows, key, up) => {
      const entries: MenuEntry[] = rows.map(([a, f], i) => ({ kind: 'item', key: `i${i}`, label: 'x', run, access: a?.normalize(f) }));
      const typed = flip(key, up).normalize('NFC');
      const want = rows.findIndex(([a]) => a !== undefined && a.toLowerCase() === key.toLowerCase());
      expect(accessMatch(entries, typed)).toBe(want < 0 ? null : want);
      t.count(want < 0 ? 'miss' : rows[want]![1] === 'NFD' && key.normalize('NFD') !== key ? 'decomposed' : 'hit');
    }), runs(RUNS));
    for (const what of ['miss', 'decomposed', 'hit']) t.atLeast(what, RUNS / 20);
  }, timeoutFor(RUNS, 1));
});

describe('typeaheadMatch, composed or decomposed', () => {
  it('lands where it would on the labels composed, typed one composed character at a time', () => {
    const t = tally();
    const label = fc.array(letter, { minLength: 1, maxLength: 3 }).map((cs) => cs.join(''));
    const labels = fc.array(fc.tuple(label, form), { minLength: 1, maxLength: 6 });
    fc.assert(fc.property(labels, fc.array(letter, { minLength: 1, maxLength: 2 }), fc.option(fc.nat(5), { nil: null }), fc.nat(),
      (ls, typed, from, pick) => {
        // Half the time, the query starts a label: its first one or two characters, composed, in another case.
        const own = [...ls[pick % ls.length]![0].normalize('NFC')].slice(0, 1 + (pick % 2)).map((c) => c.toUpperCase());
        const query = pick % 4 < 2 ? typed : own;
        const rows = (f: (s: string, i: number) => string): MenuEntry[] => ls.map(([l], i) => ({ kind: 'item', key: `i${i}`, label: f(l, i), run }));
        const composed = rows((l) => l.normalize('NFC'));
        const written = rows((l, i) => l.normalize(ls[i]![1]));
        const q = query.join('');
        const want = typeaheadMatch(composed, from, q);
        expect(typeaheadMatch(written, from, q)).toBe(want);
        t.count(want === null ? 'miss' : ls[want]![1] === 'NFD' && ls[want]![0].normalize('NFD') !== ls[want]![0] ? 'decomposed' : 'hit');
      }), runs(RUNS));
    for (const what of ['miss', 'decomposed', 'hit']) t.atLeast(what, RUNS / 20);
  }, timeoutFor(RUNS, 1));
});
