/**
 * Second-pass property test of every shipped adapter under calls that do not wait for each other: a burst of sets,
 * deletes, reads, and lists, all issued before any settles, lands in the order issued, and each read sees exactly
 * the writes issued before it.
 */
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { createIndexedDbAdapter } from './indexedDb';
import { createMemoryAdapter } from './memory';
import { jsonValue, key, prefix, runs, same, tally, timeoutFor } from './pbt.fixture';
import type { StorageAdapter } from './types';
import { urlHashAdapter } from './urlHashAdapter';
import { localStorageAdapter, sessionStorageAdapter } from './webStorage';

let db = 0;
const harnesses: { name: string; runs: number; make: () => StorageAdapter }[] = [
  { name: 'memory', runs: 150, make: () => createMemoryAdapter() },
  { name: 'indexedDb', runs: 40, make: () => createIndexedDbAdapter({ database: `order-${db++}` }) },
  { name: 'localStorage', runs: 150, make: () => { localStorage.clear(); return localStorageAdapter; } },
  { name: 'sessionStorage', runs: 150, make: () => { sessionStorage.clear(); return sessionStorageAdapter; } },
  { name: 'urlHash', runs: 100, make: () => { window.history.replaceState(null, '', '#'); return urlHashAdapter; } },
];

type Call =
  | { kind: 'set'; key: string; value: unknown }
  | { kind: 'delete'; key: string }
  | { kind: 'get'; key: string }
  | { kind: 'list'; prefix: string };

const call: fc.Arbitrary<Call> = fc.oneof(
  { weight: 3, arbitrary: fc.record({ kind: fc.constant('set' as const), key, value: fc.oneof({ weight: 5, arbitrary: jsonValue }, { weight: 1, arbitrary: fc.constant(undefined) }) }) },
  { weight: 2, arbitrary: fc.record({ kind: fc.constant('delete' as const), key }) },
  { weight: 2, arbitrary: fc.record({ kind: fc.constant('get' as const), key }) },
  fc.record({ kind: fc.constant('list' as const), prefix }),
);

afterEach(() => { vi.restoreAllMocks(); });

describe.each(harnesses)('$name, calls issued together', ({ runs: n, make }) => {
  it('lands writes in the order issued, each read seeing exactly the writes before it', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const t = tally();
    await fc.assert(fc.asyncProperty(fc.array(call, { minLength: 1, maxLength: 20 }), async (calls) => {
      const adapter = make();
      const model = new Map<string, unknown>();
      const checks: Promise<void>[] = [];
      for (const c of calls) {
        if (c.kind === 'set') {
          checks.push(adapter.set(c.key, c.value));
          if (c.value === undefined) model.delete(c.key);
          else model.set(c.key, c.value);
        } else if (c.kind === 'delete') {
          checks.push(adapter.delete(c.key));
          model.delete(c.key);
        } else if (c.kind === 'get') {
          const want = model.get(c.key);
          checks.push(adapter.get(c.key).then((got) => { expect(same(got, want)).toBe(true); t.count(want === undefined ? 'get:absent' : 'get:held'); }));
        } else {
          const want = [...model].filter(([k]) => k.startsWith(c.prefix)).sort(([a], [b]) => (a < b ? -1 : 1));
          checks.push(adapter.list(c.prefix).then((rows) => {
            const got = [...rows].sort(([a], [b]) => (a < b ? -1 : 1));
            expect(got.map(([k]) => k)).toEqual(want.map(([k]) => k));
            got.forEach(([, v], i) => expect(same(v, want[i]![1])).toBe(true));
          }));
        }
      }
      await Promise.all(checks);
      const rows = await adapter.list('');
      expect(new Map(rows).size).toBe(model.size);
      for (const [k, v] of model) expect(same(await adapter.get(k), v)).toBe(true);
    }), runs(n));
    t.atLeast('get:held', n / 10);
  }, timeoutFor(n, 30));
});
