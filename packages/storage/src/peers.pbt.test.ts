/**
 * Second-pass property tests of record caches as peers: several caches over one memory backing, as tabs over one
 * store, taking sets, deletes, flushes, closes, and time in any interleaving, settle on what storage holds; a
 * stopped or closed cache writes nothing more; and `entries` reads what `has` and `get` do.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { createMemoryAdapter } from './memory';
import { key as anyKey, prefix as anyPrefix, runs, same, tally, timeoutFor } from './pbt.fixture';
import { createRecordCache, openRecordsSync, type OwnedRecordCache } from './records';
import type { SyncStorageAdapter } from './types';

const RUNS = 150;
const PREFIX = 'p:';
const NAMES = ['a', 'b', '__proto__'] as const;

type Step =
  | { kind: 'set'; peer: number; name: string; value: number }
  | { kind: 'delete'; peer: number; name: string }
  | { kind: 'flush'; peer: number }
  | { kind: 'advance'; ms: number }
  | { kind: 'tick' };

const step = (peers: number): fc.Arbitrary<Step> => fc.oneof(
  { weight: 4, arbitrary: fc.record({ kind: fc.constant('set' as const), peer: fc.nat({ max: peers - 1 }), name: fc.constantFrom(...NAMES), value: fc.integer({ min: 0, max: 9 }) }) },
  { weight: 2, arbitrary: fc.record({ kind: fc.constant('delete' as const), peer: fc.nat({ max: peers - 1 }), name: fc.constantFrom(...NAMES) }) },
  { weight: 2, arbitrary: fc.record({ kind: fc.constant('flush' as const), peer: fc.nat({ max: peers - 1 }) }) },
  fc.record({ kind: fc.constant('advance' as const), ms: fc.constantFrom(1, 10, 50, 400) }),
  fc.constant<Step>({ kind: 'tick' }),
);

const tick = () => vi.advanceTimersByTimeAsync(0);

/** A memory adapter whose writes land, and are heard by its peers, at once, but resolve to the writer `ms` later:
 *  as a substrate may report a write before its writer hears it landed. */
function late(backing: Map<string, unknown>, ms: number): SyncStorageAdapter {
  const inner = createMemoryAdapter(backing);
  if (ms === 0) return inner;
  const wait = () => new Promise<void>((resolve) => { setTimeout(resolve, ms); });
  return {
    ...inner,
    set: async (k, v) => { await inner.set(k, v); await wait(); },
    delete: async (k) => { await inner.delete(k); await wait(); },
  };
}

/** Flush every peer and let every timer and notice run, until nothing is left to send. */
async function settle(caches: OwnedRecordCache[]): Promise<void> {
  for (let round = 0; round < 20; round++) {
    const sending = Promise.all(caches.map((c) => c.flush()));
    await vi.advanceTimersByTimeAsync(2000);
    if ((await sending).every(Boolean)) return;
  }
  throw new Error('the peers never settled');
}

describe('record caches as peers', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('peers over one store settle on what it holds, whatever the interleaving', async () => {
    const t = tally();
    await fc.assert(fc.asyncProperty(fc.integer({ min: 2, max: 3 }).chain((n) => fc.tuple(fc.constant(n), fc.array(step(n), { minLength: 1, maxLength: 40 }), fc.array(fc.constantFrom(0, 0, 5, 40), { minLength: n, maxLength: n }))), async ([n, steps, delays]) => {
      const backing = new Map<string, unknown>();
      const caches = Array.from({ length: n }, (_, i) => openRecordsSync({ storage: late(backing, delays[i]!), prefix: PREFIX, debounceMs: 10, maxWaitMs: 30 }));
      const flushes: Promise<boolean>[] = [];
      for (const s of steps) {
        if (s.kind === 'set') caches[s.peer]!.set(s.name, { v: s.value });
        else if (s.kind === 'delete') caches[s.peer]!.delete(s.name);
        else if (s.kind === 'flush') flushes.push(caches[s.peer]!.flush());
        else if (s.kind === 'advance') await vi.advanceTimersByTimeAsync(s.ms);
        else await tick();
      }
      await settle(caches);
      for (const f of flushes) expect(await f).toBe(true);
      for (const name of NAMES) {
        const stored = backing.get(PREFIX + name);
        for (const c of caches) {
          expect(c.has(name)).toBe(backing.has(PREFIX + name));
          expect(c.get(name)).toEqual(stored);
        }
        t.count(backing.has(PREFIX + name) ? 'held' : 'absent');
      }
      t.count(delays.some((d) => d > 0) ? 'late' : 'prompt');
      for (const c of caches) await c.close();
    }), runs(RUNS));
    t.atLeast('held', RUNS / 2);
    t.atLeast('absent', RUNS / 4);
    t.atLeast('late', RUNS / 3);
  }, timeoutFor(RUNS, 40));

  it('a stopped or closed cache writes nothing more, and hears nothing more', async () => {
    const t = tally();
    await fc.assert(fc.asyncProperty(fc.array(step(2), { maxLength: 20 }), fc.constantFrom('close', 'stop' as const), fc.array(step(2), { maxLength: 20 }), async (before, how, after) => {
      const backing = new Map<string, unknown>();
      const [a, b] = [0, 1].map(() => openRecordsSync({ storage: createMemoryAdapter(backing), prefix: PREFIX, debounceMs: 10, maxWaitMs: 30 })) as [OwnedRecordCache, OwnedRecordCache];
      const run = async (s: Step, ...peers: OwnedRecordCache[]) => {
        const c = 'peer' in s ? peers[s.peer % peers.length] : undefined;
        if (s.kind === 'set') c!.set(s.name, { v: s.value });
        else if (s.kind === 'delete') c!.delete(s.name);
        else if (s.kind === 'flush') void c!.flush();
        else if (s.kind === 'advance') await vi.advanceTimersByTimeAsync(s.ms);
        else await tick();
      };
      for (const s of before) await run(s, a, b);
      if (how === 'close') await a.close();
      else a.stopWriting();
      await settle([b]);
      const held = new Map([...backing]);
      const shown = NAMES.map((name) => a.get(name));
      // Only `a` writes after it closed or stopped; `b` writes too, and `a` must not take what it writes.
      for (const s of after) await run(s, a);
      await vi.advanceTimersByTimeAsync(5000);
      if (how === 'stop') expect([...backing]).toEqual([...held]);
      for (const s of after) await run(s, b);
      await settle([b]);
      const local = after.filter((s) => s.kind === 'set' || s.kind === 'delete');
      if (local.length === 0) expect(NAMES.map((name) => a.get(name))).toEqual(shown);
      t.count(how);
    }), runs(RUNS));
    t.atLeast('close', RUNS / 4);
    t.atLeast('stop', RUNS / 4);
  }, timeoutFor(RUNS, 40));
});

describe('entries', () => {
  it('lists what has and get read, for any prefix of names', () => {
    fc.assert(fc.property(fc.array(fc.tuple(anyKey, fc.option(fc.integer(), { nil: undefined })), { maxLength: 12 }), anyPrefix, (writes, p) => {
      const cache = createRecordCache({ storage: createMemoryAdapter(), prefix: PREFIX });
      for (const [k, v] of writes) cache.set(k, v);
      const listed = cache.entries(p);
      const names = new Set(writes.map(([k]) => k));
      expect(listed.map(([k]) => k).sort()).toEqual([...names].filter((k) => k.startsWith(p) && cache.has(k)).sort());
      for (const [k, v] of listed) expect(same(v, cache.get(k))).toBe(true);
      void cache.close();
    }), runs(RUNS));
  }, timeoutFor(RUNS, 2));
});

describe('shrunk counterexamples', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('a peer whose write resolves after another writer\'s lands takes what storage ends up holding', async () => {
    const backing = new Map<string, unknown>();
    const a = openRecordsSync({ storage: late(backing, 50), prefix: PREFIX });
    const b = openRecordsSync({ storage: late(backing, 50), prefix: PREFIX });
    a.set('x', 1);
    b.set('x', 2);
    const sent = [a.flush(), b.flush()];
    await vi.advanceTimersByTimeAsync(1000);
    expect(await Promise.all(sent)).toEqual([true, true]);
    expect([backing.get(`${PREFIX}x`), a.get('x'), b.get('x')]).toEqual([2, 2, 2]);
  });
});
