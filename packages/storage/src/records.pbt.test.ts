/**
 * Stateful model test of a record cache and its write queue over storage whose every write waits until the test
 * lets it land or fail: local sets and deletes, another writer's changes, flushes, and time passing, in any order.
 * After every step the cache holds what the model says, each local change was reported once, another writer's
 * change is taken exactly when no write of ours to the record is still unlanded, at most one write per record is
 * on its way, and each write lands at most once and never before an older one. At the end, with storage letting
 * everything through, it holds what the model holds and `flush` resolves true.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { runs, tally, timeoutFor } from './pbt.fixture';
import { createRecordCache, openRecords, type OwnedRecordCache, type RecordChange } from './records';
import type { StorageAdapter, StorageChange } from './types';

const RUNS = 150;
const PREFIX = 'p:';
const NAMES = ['a', 'b', '__proto__'] as const;

interface Op { key: string; value: unknown; tag: number; resolve(): void; reject(e: unknown): void }

/** Storage whose writes wait on `release`, recording which local write each landing was. */
function gatedStorage(tagOf: (key: string) => number) {
  const backing = new Map<string, unknown>();
  const pending: Op[] = [];
  const landed = new Map<string, number[]>();
  const subs = new Set<{ prefix: string; on: (c: StorageChange[]) => void }>();
  const state = { listFails: false };
  const write = (key: string, value: unknown, tag: number) => new Promise<void>((resolve, reject) => {
    pending.push({ key, value, tag, resolve, reject });
  });
  const adapter: StorageAdapter = {
    get: async (k) => backing.get(k),
    list: async (p) => {
      if (state.listFails) throw new Error('storage would not list');
      return [...backing].filter(([k]) => k.startsWith(p));
    },
    set: (k, v) => (v === undefined ? adapter.delete(k) : write(k, v, (v as { w: number }).w)),
    delete: (k) => write(k, undefined, tagOf(k)),
    subscribe: (prefix, on) => {
      const sub = { prefix, on };
      subs.add(sub);
      return () => { subs.delete(sub); };
    },
  };
  return {
    adapter, backing, pending, landed, state,
    release(i: number, ok: boolean): void {
      const [op] = pending.splice(i, 1);
      if (!op) return;
      if (!ok) { op.reject(new Error('storage said no')); return; }
      if (op.value === undefined) backing.delete(op.key);
      else backing.set(op.key, op.value);
      landed.set(op.key, [...(landed.get(op.key) ?? []), op.tag]);
      op.resolve();
    },
    foreign(key: string, value: unknown): void {
      if (value === undefined) backing.delete(key);
      else backing.set(key, value);
      for (const s of subs) if (key.startsWith(s.prefix)) queueMicrotask(() => { if (subs.has(s)) s.on([[key, value]]); });
    },
  };
}

interface Model {
  values: Map<string, unknown>;
  /** The newest local write to each record, by tag. */
  latest: Map<string, number>;
  next: number;
  local: number;
  /** The first read has not landed: writes are held, and another writer's changes are not heard. */
  unread: boolean;
}

interface Real {
  cache: OwnedRecordCache;
  storage: ReturnType<typeof gatedStorage>;
  heard: RecordChange[];
  overruled: [string, unknown][];
  flushes: Promise<boolean>[];
}

const t = tally();
const tick = () => vi.advanceTimersByTimeAsync(0);

/** Whether a local write to `name` has yet to land: our write is queued, on its way, or waiting to be sent again. */
const unlanded = (m: Model, r: Real, name: string): boolean => {
  const tag = m.latest.get(name);
  return tag !== undefined && !(r.storage.landed.get(PREFIX + name) ?? []).includes(tag);
};

/** A first read the cache says landed, taken into the model: storage's records, except where ours are unlanded. */
function observeRead(m: Model, r: Real): void {
  if (!m.unread || !r.cache.writable) return;
  m.unread = false;
  for (const n of NAMES) {
    if (unlanded(m, r, n) || !r.storage.backing.has(PREFIX + n)) continue;
    m.values.set(n, r.storage.backing.get(PREFIX + n));
  }
  t.count('read landed');
}

function check(m: Model, r: Real): void {
  observeRead(m, r);
  expect(r.cache.writable).toBe(!m.unread);
  if (m.unread) expect(r.storage.pending).toEqual([]);
  for (const n of NAMES) {
    expect(r.cache.has(n)).toBe(m.values.has(n));
    expect(r.cache.get(n)).toEqual(m.values.get(n));
  }
  expect(r.heard.filter((c) => c.origin === 'local').length).toBe(m.local);
  const keys = r.storage.pending.map((op) => op.key);
  expect(new Set(keys).size).toBe(keys.length);
  for (const tags of r.storage.landed.values()) {
    for (let i = 1; i < tags.length; i++) expect(tags[i]!).toBeGreaterThan(tags[i - 1]!);
  }
}

type Cmd = fc.AsyncCommand<Model, Real>;
const name = fc.constantFrom(...NAMES);

const commands = fc.commands([
  name.map((n): Cmd => ({
    check: () => true,
    async run(m, r) {
      const tag = m.next++;
      const value = { w: tag };
      m.values.set(n, value);
      m.latest.set(n, tag);
      m.local++;
      r.cache.set(n, value);
      t.count('set');
      check(m, r);
    },
    toString: () => `set(${n})`,
  })),
  name.map((n): Cmd => ({
    check: () => true,
    async run(m, r) {
      if (m.values.has(n) || m.unread) {
        m.values.delete(n);
        m.latest.set(n, m.next++);
        m.local++;
        t.count('delete');
      } else t.count('delete:absent');
      r.cache.delete(n);
      check(m, r);
    },
    toString: () => `delete(${n})`,
  })),
  fc.tuple(name, fc.option(fc.integer({ min: 0, max: 9 }), { nil: undefined })).map(([n, v]): Cmd => ({
    check: () => true,
    async run(m, r) {
      const value = v === undefined ? undefined : { remote: v };
      const ours = unlanded(m, r, n);
      const overruledBefore = r.overruled.length;
      const unread = m.unread;
      r.storage.foreign(PREFIX + n, value);
      await tick();
      if (unread) {
        // Not heard: the first read, when it lands, brings it.
        expect(r.overruled.length).toBe(overruledBefore);
        t.count('remote:unread');
      } else if (ours) {
        expect(r.overruled.slice(overruledBefore)).toEqual([[n, value]]);
        t.count('remote:overruled');
      } else {
        expect(r.overruled.length).toBe(overruledBefore);
        if (value === undefined) m.values.delete(n);
        else m.values.set(n, value);
        t.count('remote:taken');
      }
      check(m, r);
    },
    toString: () => `remote(${n}, ${v})`,
  })),
  fc.tuple(fc.nat(), fc.oneof({ weight: 3, arbitrary: fc.constant(true) }, { weight: 1, arbitrary: fc.constant(false) })).map(([i, ok]): Cmd => ({
    check: (m) => m.next > 0,
    async run(m, r) {
      const n = r.storage.pending.length;
      if (n > 0) { r.storage.release(i % n, ok); t.count(ok ? 'landed' : 'failed'); }
      await tick();
      check(m, r);
    },
    toString: () => `release(${i}, ${ok ? 'ok' : 'fail'})`,
  })),
  fc.constantFrom(0, 5, 15, 40, 200).map((ms): Cmd => ({
    check: () => true,
    async run(m, r) {
      await vi.advanceTimersByTimeAsync(ms);
      check(m, r);
    },
    toString: () => `advance(${ms})`,
  })),
  fc.constant<Cmd>({
    check: (m) => m.unread,
    async run(m, r) {
      r.storage.state.listFails = false;
      expect(await r.cache.read()).toBe(true);
      check(m, r);
    },
    toString: () => 'storage lists again',
  }),
  fc.constant<Cmd>({
    check: () => true,
    async run(m, r) {
      r.flushes.push(r.cache.flush());
      await tick();
      t.count('flush');
      check(m, r);
    },
    toString: () => 'flush',
  }),
], { maxCommands: 40, size: 'large' });

/** Let every write through until nothing is left to send. */
async function drain(r: Real): Promise<void> {
  r.storage.state.listFails = false;
  await r.cache.read();
  for (let round = 0; round < 50; round++) {
    while (r.storage.pending.length > 0) { r.storage.release(0, true); await tick(); }
    const flushed = r.cache.flush();
    await tick();
    while (r.storage.pending.length > 0) { r.storage.release(0, true); await tick(); }
    if (await flushed) return;
    await vi.advanceTimersByTimeAsync(1000);
  }
  throw new Error('the queue never drained');
}

describe('records — stateful model', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('holds what the model holds, lands each write once and in order, and converges on storage', async () => {
    await fc.assert(fc.asyncProperty(fc.boolean(), fc.option(fc.integer({ min: 0, max: 9 }), { nil: undefined }), commands, async (unreadFirst, stored, cmds) => {
      let model: Model | null = null;
      const setup = async () => {
        model = { values: new Map(), latest: new Map(), next: 0, local: 0, unread: unreadFirst };
        const m = model;
        const storage = gatedStorage((key) => m.latest.get(key.slice(PREFIX.length)) ?? -1);
        if (stored !== undefined) storage.backing.set(`${PREFIX}a`, { stored });
        const options = { storage: storage.adapter, prefix: PREFIX, debounceMs: 10, maxWaitMs: 30, retryMs: 20, retryMaxMs: 80 };
        storage.state.listFails = unreadFirst;
        const cache = unreadFirst ? await openRecords(options) : createRecordCache(options);
        if (!unreadFirst && stored !== undefined) storage.backing.delete(`${PREFIX}a`);
        const real: Real = { cache, storage, heard: [], overruled: [], flushes: [] };
        cache.subscribe((c) => real.heard.push(...c));
        cache.onOverruled((c) => real.overruled.push(...c));
        return { model: m, real };
      };
      let real: Real | null = null;
      await fc.asyncModelRun(async () => { const s = await setup(); real = s.real; return s; }, cmds);
      const r = real!;
      const m = model!;
      await drain(r);
      observeRead(m, r);
      for (const n of NAMES) expect(r.storage.backing.get(PREFIX + n)).toEqual(m.values.get(n));
      for (const [n, tag] of m.latest) {
        const landed = r.storage.landed.get(PREFIX + n) ?? [];
        expect(landed.filter((x) => x === tag).length).toBe(1);
        expect(landed.at(-1)).toBe(tag);
      }
      for (const f of r.flushes) expect(typeof (await f)).toBe('boolean');
      t.count('drained');
      await r.cache.close();
    }), runs(RUNS));
    for (const k of ['set', 'delete', 'landed', 'flush', 'remote:taken', 'remote:overruled']) t.atLeast(k, RUNS / 2);
    for (const k of ['failed', 'delete:absent', 'read landed', 'remote:unread']) t.atLeast(k, RUNS / 10);
  }, timeoutFor(RUNS, 60));
});

describe('shrunk counterexamples', () => {
  it('deleting a record whose delete is still queued reports nothing', () => {
    const cache = createRecordCache({ storage: gatedStorage(() => 0).adapter, prefix: PREFIX });
    const heard: RecordChange[] = [];
    cache.subscribe((c) => heard.push(...c));
    cache.set('__proto__', { w: 0 });
    cache.delete('__proto__');
    cache.delete('__proto__');
    expect(heard.map((c) => c.value)).toEqual([{ w: 0 }, undefined]);
  });
});
