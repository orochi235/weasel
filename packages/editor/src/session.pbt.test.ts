/**
 * Stateful property test of the session store: runs of saves into a store that refuses some keys' writes and some
 * keys' removals, and reads through `readStored`, against a model of what the store holds. A save whose document
 * fails leaves the document and the dependents it held where removing or rewriting them is allowed; one whose
 * dependent fails leaves the document and none of its dependents; and a read answers the stored value or the
 * fallback, never a throw. Also the file-warning toast text.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { openRecordsSync, type SyncStorageAdapter } from '@weasel-js/storage';
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

function refusing(store: Map<string, unknown>, s: Save): SyncStorageAdapter {
  const listSync = (prefix: string): [string, unknown][] => [...store].filter(([k]) => k.startsWith(prefix));
  return {
    get: async (k) => store.get(k),
    list: async (prefix) => listSync(prefix),
    listSync,
    set: async (k, v) => { if (s.fullSet.includes(k)) throw new Error('quota'); store.set(k, v); },
    delete: async (k) => { if (s.fullRemove.includes(k)) throw new Error('denied'); store.delete(k); },
  };
}

/** What the store holds after `s`, by the order `writeSlots` writes in. */
function model(before: Map<string, unknown>, s: Save): Map<string, unknown> {
  const after = new Map(before);
  const [doc, docValue] = s.primary;
  const lands = (k: string) => !s.fullSet.includes(k);
  const removable = (k: string) => !s.fullRemove.includes(k);
  if (!lands(doc)) {
    for (const [k] of s.dependents) if (before.has(k) && removable(k) && !lands(k)) after.delete(k);
    return after;
  }
  after.set(doc, docValue);
  const allLand = s.dependents.every(([k]) => lands(k));
  for (const [k, v] of s.dependents) {
    if (allLand) after.set(k, v);
    else if (removable(k)) after.delete(k);
    else if (lands(k)) after.set(k, v);
  }
  return after;
}

describe('writeSession', () => {
  afterEach(() => { vi.restoreAllMocks(); });
  it('holds what a model of the store holds through saves that fail anywhere', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const seen = tally();
    await fc.assert(fc.asyncProperty(fc.array(save, { minLength: 1, maxLength: 8 }), async (saves) => {
      const store = new Map<string, unknown>();
      let want = new Map<string, unknown>();
      for (const s of saves) {
        const records = openRecordsSync({ storage: refusing(store, s), prefix: '', retryMs: false });
        const ok = await writeSession(s.primary, s.dependents, records);
        await records.close();
        const docFailed = s.fullSet.includes(s.primary[0]);
        expect(ok).toBe(!docFailed);
        seen.count(docFailed ? 'document failed'
          : s.dependents.some(([k]) => s.fullSet.includes(k)) ? 'dependent failed'
            : s.dependents.length > 0 ? 'all saved' : 'document alone');
        want = model(want, s);
        expect(new Map([...store].sort())).toEqual(new Map([...want].sort()));
      }
    }), runs(RUNS));
    for (const what of ['document failed', 'all saved', 'dependent failed']) seen.atLeast(what, RUNS / 4);
  }, timeoutFor(RUNS, 3));
});

describe('readStored', () => {
  afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });
  it('answers the stored value, or the fallback when there is none or storage is unreachable', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const seen = tally();
    fc.assert(fc.property(key, fc.option(fc.oneof(json, fc.string({ maxLength: 6 }))), fc.boolean(), (k, raw, unreachable) => {
      vi.spyOn(window, 'localStorage', 'get').mockRestore();
      localStorage.clear();
      if (raw !== null) localStorage.setItem(k, raw);
      if (unreachable) vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('denied'); });
      const FALLBACK = Symbol('fallback');
      const got = readStored<unknown>(k, (value) => value, () => FALLBACK);
      let want: unknown = FALLBACK;
      if (!unreachable && raw !== null) { try { want = JSON.parse(raw); } catch { want = raw; } }
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
