/**
 * Stateful property test of the session store: runs of saves into a store that refuses some keys' writes and some
 * keys' removals, and reads through `readStored`, against a model of what the store holds. A save whose document
 * fails leaves the store as it was; one whose dependent fails leaves the document and none of its dependents; and a
 * read answers the parsed entry or the fallback, never a throw. Also the file-warning toast text.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { readStored, writeSession, type SessionEntry } from './sessionStore';
import { describeFileWarnings, type FileDeed } from './fileWarnings';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 300;

const key = fc.constantFrom('doc', 'undo', 'redo', 'view', '__proto__', 'constructor');
const json = fc.jsonValue({ maxDepth: 2 }).map((v) => JSON.stringify(v));

interface Save { primary: SessionEntry; dependents: SessionEntry[]; fullSet: string[]; fullRemove: string[] }
const save: fc.Arbitrary<Save> = fc.uniqueArray(key, { minLength: 1, maxLength: 4 }).chain((keys) => fc.record({
  primary: json.map((j): SessionEntry => [keys[0]!, j]),
  dependents: fc.tuple(...keys.slice(1).map((k) => json.map((j): SessionEntry => [k, j]))),
  fullSet: fc.subarray(keys),
  fullRemove: fc.subarray(keys),
})) as fc.Arbitrary<Save>;

describe('writeSession', () => {
  it('holds what a model of the store holds through saves that fail anywhere', () => {
    const seen = tally();
    fc.assert(fc.property(fc.array(save, { minLength: 1, maxLength: 8 }), (saves) => {
      const store = new Map<string, string>();
      const model = new Map<string, string>();
      for (const s of saves) {
        const storage = {
          setItem: (k: string, v: string) => { if (s.fullSet.includes(k)) throw new Error('quota'); store.set(k, v); },
          removeItem: (k: string) => { if (s.fullRemove.includes(k)) throw new Error('denied'); store.delete(k); },
        };
        const ok = writeSession(storage, s.primary, s.dependents);
        if (s.fullSet.includes(s.primary[0])) {
          seen.count('document failed');
          expect(ok).toBe(false);
        } else {
          expect(ok).toBe(true);
          model.set(s.primary[0], s.primary[1]);
          const failAt = s.dependents.findIndex(([k]) => s.fullSet.includes(k));
          if (failAt < 0) {
            for (const [k, v] of s.dependents) model.set(k, v);
            seen.count(s.dependents.length > 0 ? 'all saved' : 'document alone');
          } else {
            seen.count('dependent failed');
            for (const [k, v] of s.dependents.slice(0, failAt)) model.set(k, v);
            for (const [k] of s.dependents) if (!s.fullRemove.includes(k)) model.delete(k);
          }
        }
        expect(new Map([...store].sort())).toEqual(new Map([...model].sort()));
      }
    }), runs(RUNS));
    for (const what of ['document failed', 'all saved', 'dependent failed']) seen.atLeast(what, RUNS / 4);
  }, timeoutFor(RUNS, 3));
});

describe('readStored', () => {
  afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });
  it('answers the parsed entry, or the fallback when there is none, parsing fails, or storage is unreachable', () => {
    const seen = tally();
    fc.assert(fc.property(key, fc.option(fc.oneof(json, fc.string({ maxLength: 6 }))), fc.boolean(), (k, raw, unreachable) => {
      vi.restoreAllMocks();
      localStorage.clear();
      if (raw !== null) localStorage.setItem(k, raw);
      if (unreachable) vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('denied'); });
      const FALLBACK = Symbol('fallback');
      const got = readStored<unknown>(k, (text) => JSON.parse(text) as unknown, () => FALLBACK);
      let want: unknown = FALLBACK;
      if (!unreachable && raw) { try { want = JSON.parse(raw); } catch { want = FALLBACK; } }
      seen.count(want === FALLBACK ? 'fallback' : 'read');
      expect(got).toEqual(want);
    }), runs(RUNS));
    seen.atLeast('read', RUNS / 5);
    seen.atLeast('fallback', RUNS / 5);
  }, timeoutFor(RUNS, 3));
});

describe('describeFileWarnings', () => {
  it('counts the distinct warnings in the title and quotes the first three in order', () => {
    const seen = tally();
    fc.assert(fc.property(fc.constantFrom<FileDeed>('Opened', 'Imported', 'Saved', 'Exported'),
      fc.array(fc.oneof(fc.constantFrom('a', 'b', 'c', 'd', 'e', '__proto__'), fc.string({ minLength: 1, maxLength: 5 })), { maxLength: 10 }),
      (did, warnings) => {
        const distinct = [...new Set(warnings)];
        const { title, description } = describeFileWarnings(did, warnings);
        expect(title).toBe(`${did} with ${distinct.length} warning${distinct.length === 1 ? '' : 's'}`);
        const quoted = distinct.slice(0, 3);
        const rest = distinct.length - quoted.length;
        expect(description).toBe([...quoted, ...(rest > 0 ? [`and ${rest} more`] : [])].join('; '));
        seen.count(rest > 0 ? 'counted' : distinct.length === 1 ? 'one' : 'quoted');
      }), runs(RUNS));
    seen.atLeast('counted', RUNS / 5);
    seen.atLeast('one', RUNS / 20);
  }, timeoutFor(RUNS, 1));
});
