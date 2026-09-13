import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryAdapter } from './adapters';
import { createRecordCache, openRecords, type RecordChange } from './records';
import type { StorageAdapter } from './types';

const PREFIX = 'lk:t:';

/** Two tabs: each opens its own cache over one shared backing. */
async function twoTabs(backing = new Map<string, unknown>()) {
  const a = await openRecords({ storage: createMemoryAdapter(backing), prefix: PREFIX });
  const b = await openRecords({ storage: createMemoryAdapter(backing), prefix: PREFIX });
  return { a, b, backing };
}

/** Let queued microtasks — the memory adapter's notifications — run. */
const tick = () => vi.advanceTimersByTimeAsync(0);

describe('openRecords', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('holds every record under its prefix, by name', async () => {
    const backing = new Map<string, unknown>([
      ['lk:t:meta', { version: 4 }],
      ['lk:t:trial:a', { id: 'a' }],
      ['lk:other:meta', { version: 4 }],
    ]);
    const cache = await openRecords({ storage: createMemoryAdapter(backing), prefix: PREFIX });
    expect(new Map(cache.entries())).toEqual(
      new Map<string, unknown>([
        ['meta', { version: 4 }],
        ['trial:a', { id: 'a' }],
      ]),
    );
    expect(cache.entries('trial:')).toEqual([['trial:a', { id: 'a' }]]);
  });

  it('opens empty and never writes when the read fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const set = vi.fn(async () => {});
    const broken: StorageAdapter = {
      get: async () => undefined,
      list: async () => {
        throw new Error('disk on fire');
      },
      set,
      delete: async () => {},
    };
    const cache = await openRecords({ storage: broken, prefix: PREFIX });
    expect(cache.writable).toBe(false);
    cache.set('meta', { version: 4 });
    await vi.advanceTimersByTimeAsync(5000);
    await cache.flush();
    expect(set).not.toHaveBeenCalled();
    expect(cache.get('meta')).toEqual({ version: 4 });
    warn.mockRestore();
  });
});

describe('writing', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('holds a write in memory at once and in storage after the debounce', async () => {
    const backing = new Map<string, unknown>();
    const cache = await openRecords({ storage: createMemoryAdapter(backing), prefix: PREFIX });
    cache.set('layout', { a: 1 });
    expect(cache.get('layout')).toEqual({ a: 1 });
    await vi.advanceTimersByTimeAsync(299);
    expect(backing.has('lk:t:layout')).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(backing.get('lk:t:layout')).toEqual({ a: 1 });
  });

  it('writes under continuous change no later than the max wait', async () => {
    const backing = new Map<string, unknown>();
    const cache = await openRecords({ storage: createMemoryAdapter(backing), prefix: PREFIX });
    for (let i = 0; i < 12; i++) {
      cache.set('layout', { i });
      await vi.advanceTimersByTimeAsync(100);
    }
    expect(backing.get('lk:t:layout')).toBeDefined();
  });

  it('tells its own listeners about local writes and deletes', async () => {
    const cache = await openRecords({ storage: createMemoryAdapter(), prefix: PREFIX });
    const heard: RecordChange[] = [];
    cache.subscribe((c) => heard.push(...c));
    cache.set('value:lab:x', 1);
    cache.delete('value:lab:x');
    expect(heard).toEqual([
      { name: 'value:lab:x', value: 1, origin: 'local' },
      { name: 'value:lab:x', value: undefined, origin: 'local' },
    ]);
  });

  it('deletes from storage', async () => {
    const backing = new Map<string, unknown>([['lk:t:save:s', { id: 's' }]]);
    const cache = await openRecords({ storage: createMemoryAdapter(backing), prefix: PREFIX });
    cache.delete('save:s');
    await cache.flush();
    expect(backing.has('lk:t:save:s')).toBe(false);
  });

  it('keeps a failed write in memory, and writes it again on its next change', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const backing = new Map<string, unknown>();
    const memory = createMemoryAdapter(backing);
    const flaky: StorageAdapter = {
      ...memory,
      set: vi.fn(memory.set).mockImplementationOnce(async () => {
        throw new Error('quota');
      }),
    };
    const cache = await openRecords({ storage: flaky, prefix: PREFIX });
    cache.set('layout', { v: 1 });
    await cache.flush();
    expect(warn).toHaveBeenCalled();
    expect(cache.get('layout')).toEqual({ v: 1 });
    expect(backing.has('lk:t:layout')).toBe(false);

    cache.set('layout', { v: 2 });
    await cache.flush();
    expect(backing.get('lk:t:layout')).toEqual({ v: 2 });
    warn.mockRestore();
  });

  it('sends queued writes when the page hides', async () => {
    const backing = new Map<string, unknown>();
    const cache = await openRecords({ storage: createMemoryAdapter(backing), prefix: PREFIX });
    cache.set('layout', { a: 1 });
    window.dispatchEvent(new Event('pagehide'));
    await tick();
    expect(backing.get('lk:t:layout')).toEqual({ a: 1 });
    await cache.close();
  });

  it('sends queued writes on close, and none after', async () => {
    const backing = new Map<string, unknown>();
    const cache = await openRecords({ storage: createMemoryAdapter(backing), prefix: PREFIX });
    cache.set('layout', { a: 1 });
    await cache.close();
    expect(backing.get('lk:t:layout')).toEqual({ a: 1 });
    cache.set('layout', { a: 2 });
    await vi.advanceTimersByTimeAsync(5000);
    expect(backing.get('lk:t:layout')).toEqual({ a: 1 });
  });

  it('seeds records without writing them', async () => {
    const backing = new Map<string, unknown>();
    const cache = createRecordCache({ storage: createMemoryAdapter(backing), prefix: PREFIX });
    cache.seed([['meta', { version: 4 }]]);
    await cache.flush();
    expect(cache.get('meta')).toEqual({ version: 4 });
    expect(backing.size).toBe(0);
  });
});

describe('two writers', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("applies another writer's change and reports it as remote", async () => {
    const { a, b } = await twoTabs();
    const heard: RecordChange[] = [];
    b.subscribe((c) => heard.push(...c));
    a.set('trial:x', { id: 'x', n: 1 });
    await a.flush();
    await tick();
    expect(b.get('trial:x')).toEqual({ id: 'x', n: 1 });
    expect(heard).toEqual([{ name: 'trial:x', value: { id: 'x', n: 1 }, origin: 'remote' }]);
  });

  it('keeps edits to different records from both writers', async () => {
    const { a, b, backing } = await twoTabs();
    a.set('trial:one', { n: 'a' });
    b.set('trial:two', { n: 'b' });
    await Promise.all([a.flush(), b.flush()]);
    await tick();
    expect(backing.get('lk:t:trial:one')).toEqual({ n: 'a' });
    expect(backing.get('lk:t:trial:two')).toEqual({ n: 'b' });
    expect(a.get('trial:two')).toEqual({ n: 'b' });
    expect(b.get('trial:one')).toEqual({ n: 'a' });
  });

  it('lets a queued local write beat an incoming one, and land as the newest', async () => {
    const { a, b, backing } = await twoTabs();
    b.set('trial:x', { from: 'b' });
    a.set('trial:x', { from: 'a' });
    await a.flush();
    await tick();
    expect(b.get('trial:x')).toEqual({ from: 'b' });
    await b.flush();
    await tick();
    expect(backing.get('lk:t:trial:x')).toEqual({ from: 'b' });
    expect(a.get('trial:x')).toEqual({ from: 'b' });
  });

  it("propagates another writer's delete", async () => {
    const backing = new Map<string, unknown>([['lk:t:trial:x', { id: 'x' }]]);
    const { a, b } = await twoTabs(backing);
    a.delete('trial:x');
    await a.flush();
    await tick();
    expect(b.has('trial:x')).toBe(false);
  });

  it('stops hearing other writers once closed', async () => {
    const { a, b } = await twoTabs();
    await b.close();
    a.set('trial:x', { id: 'x' });
    await a.flush();
    await tick();
    expect(b.has('trial:x')).toBe(false);
  });

  it('keeps a change that lands between the read and the subscription', async () => {
    const backing = new Map<string, unknown>();
    const writer = createMemoryAdapter(backing);
    const reader = createMemoryAdapter(backing);
    const slowList: StorageAdapter = {
      ...reader,
      list: async (prefix) => {
        const listed = await reader.list(prefix);
        await writer.set('lk:t:trial:late', { id: 'late' });
        await Promise.resolve();
        return listed;
      },
    };
    const cache = await openRecords({ storage: slowList, prefix: PREFIX });
    await tick();
    expect(cache.get('trial:late')).toEqual({ id: 'late' });
  });
});
