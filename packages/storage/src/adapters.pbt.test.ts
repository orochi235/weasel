/**
 * Stateful model test of every shipped adapter against one model, a `Map`: sets (an `undefined` one deleting),
 * deletes, reads, and lists under prefixes crowding a key's upper edge, with keys named for what an object
 * inherits. JSON substrates get values JSON keeps; IndexedDB and memory get structured-clone values too. Each
 * read must match the model exactly, as a copy, and a JSON substrate must not warn about a value JSON keeps.
 */
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { createIndexedDbAdapter } from './indexedDb';
import { createMemoryAdapter } from './memory';
import { isJsonSafe, toJson } from './json';
import { cloneValue, jsonValue, key, prefix, runs, same, tally, timeoutFor } from './pbt.fixture';
import type { StorageAdapter } from './types';
import { urlHashAdapter } from './urlHashAdapter';
import { localStorageAdapter, sessionStorageAdapter } from './webStorage';

type Model = Map<string, unknown>;
interface Real { adapter: StorageAdapter }

let db = 0;
const harnesses: { name: string; json: boolean; runs: number; make: () => StorageAdapter }[] = [
  { name: 'memory', json: false, runs: 150, make: () => createMemoryAdapter() },
  { name: 'indexedDb', json: false, runs: 40, make: () => createIndexedDbAdapter({ database: `pbt-${db++}` }) },
  { name: 'localStorage', json: true, runs: 150, make: () => { localStorage.clear(); return localStorageAdapter; } },
  { name: 'sessionStorage', json: true, runs: 150, make: () => { sessionStorage.clear(); return sessionStorageAdapter; } },
  { name: 'urlHash', json: true, runs: 100, make: () => { window.history.replaceState(null, '', '#'); return urlHashAdapter; } },
];

let t = tally();

/** A row list as a map, failing on a key listed twice. */
function asMap(rows: [string, unknown][]): Map<string, unknown> {
  const out = new Map(rows);
  expect(out.size).toBe(rows.length);
  return out;
}

function checkList(m: Model, p: string, rows: [string, unknown][]): void {
  const got = asMap(rows);
  const want = [...m].filter(([k]) => k.startsWith(p));
  expect([...got.keys()].sort()).toEqual(want.map(([k]) => k).sort());
  for (const [k, v] of want) expect(same(got.get(k), v)).toBe(true);
  t.count(want.length > 0 ? 'list:some' : 'list:none');
}

const commands = (value: fc.Arbitrary<unknown>) => fc.commands([
  fc.tuple(key, fc.oneof({ weight: 6, arbitrary: value }, { weight: 1, arbitrary: fc.constant(undefined) })).map(([k, v]): fc.AsyncCommand<Model, Real> => ({
    check: () => true,
    async run(m, r) {
      // A copy goes in: changing what was handed over afterward changes nothing stored.
      const handed = v !== null && typeof v === 'object' ? structuredClone(v) : v;
      await r.adapter.set(k, handed);
      if (v === undefined) m.delete(k);
      else m.set(k, v);
      if (handed !== null && typeof handed === 'object' && !Array.isArray(handed) && Object.prototype.toString.call(handed) === '[object Object]') {
        (handed as Record<string, unknown>).__mutated__ = true;
      }
      t.count(v === undefined ? 'set:undefined' : 'set');
    },
    toString: () => `set(${JSON.stringify(k)}, ${fc.stringify(v)})`,
  })),
  key.map((k): fc.AsyncCommand<Model, Real> => ({
    check: () => true,
    async run(m, r) {
      await r.adapter.delete(k);
      t.count(m.has(k) ? 'delete' : 'delete:absent');
      m.delete(k);
    },
    toString: () => `delete(${JSON.stringify(k)})`,
  })),
  key.map((k): fc.AsyncCommand<Model, Real> => ({
    check: () => true,
    async run(m, r) {
      const got = await r.adapter.get(k);
      expect(same(got, m.get(k))).toBe(true);
      t.count(m.has(k) ? 'get:held' : 'get:absent');
    },
    toString: () => `get(${JSON.stringify(k)})`,
  })),
  prefix.map((p): fc.AsyncCommand<Model, Real> => ({
    check: () => true,
    async run(m, r) {
      checkList(m, p, await r.adapter.list(p));
      if (r.adapter.listSync) checkList(m, p, r.adapter.listSync(p));
    },
    toString: () => `list(${JSON.stringify(p)})`,
  })),
], { maxCommands: 30, size: 'large' });

describe('adapters — stateful model', () => {
  afterEach(() => vi.restoreAllMocks());

  for (const h of harnesses) {
    it(`${h.name} reads back what the model holds`, async () => {
      t = tally();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await fc.assert(fc.asyncProperty(commands(h.json ? jsonValue : fc.oneof(jsonValue, cloneValue)), async (cmds) => {
        await fc.asyncModelRun(() => ({ model: new Map(), real: { adapter: h.make() } }), cmds);
      }), runs(h.runs));
      if (h.json) expect(warn).not.toHaveBeenCalled();
      for (const k of ['set', 'get:absent', 'delete:absent', 'list:some']) t.atLeast(k, h.runs / 2);
      for (const k of ['delete', 'get:held', 'set:undefined']) t.atLeast(k, h.runs / 10);
    }, timeoutFor(h.runs, h.name === 'indexedDb' ? 300 : 40));
  }
});

describe('JSON substrates — values JSON changes', () => {
  afterEach(() => vi.restoreAllMocks());

  for (const h of harnesses.filter((x) => x.json)) {
    it(`${h.name} stores what JSON keeps of any structured-clone value, warning at most once per key it changes`, async () => {
      const seen = tally();
      await fc.assert(fc.asyncProperty(fc.array(fc.tuple(key, cloneValue), { minLength: 1, maxLength: 5 }), async (writes) => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const adapter = h.make();
        const warned = new Set<string>();
        for (const [k, v] of writes) {
          await adapter.set(k, v);
          expect(same(await adapter.get(k), JSON.parse(toJson(v)))).toBe(true);
          if (!isJsonSafe(v)) warned.add(k);
          seen.count(isJsonSafe(v) ? 'kept' : 'changed');
        }
        expect(warn.mock.calls.length).toBeLessThanOrEqual(warned.size);
        warn.mockRestore();
      }), runs(h.runs));
      seen.atLeast('changed', h.runs / 4);
      seen.atLeast('kept', h.runs / 4);
    }, timeoutFor(h.runs, 40));
  }
});

describe('urlHashAdapter — a fragment it did not write', () => {
  it('a delete of a key the fragment does not hold leaves the fragment as it was', async () => {
    await fc.assert(fc.asyncProperty(fc.oneof(fc.webFragments(), fc.constantFrom('section-2', 'e30=', '')), key, async (fragment, k) => {
      window.history.replaceState(null, '', `#${fragment}`);
      const before = window.location.hash;
      fc.pre((await urlHashAdapter.get(k)) === undefined);
      await urlHashAdapter.delete(k);
      expect(window.location.hash).toBe(before);
    }), runs(200));
  });
});

describe('shrunk counterexamples', () => {
  it('a delete of an absent key leaves an anchor fragment alone', async () => {
    window.history.replaceState(null, '', '#section-2');
    await urlHashAdapter.delete('a');
    expect(window.location.hash).toBe('#section-2');
  });

  it('a JSON substrate writes a bigint as its digits, with a warning, instead of rejecting', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.clear();
    await localStorageAdapter.set('shrunk:big', { n: 10n });
    expect(await localStorageAdapter.get('shrunk:big')).toEqual({ n: '10' });
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
