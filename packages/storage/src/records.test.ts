import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryAdapter } from './memory';
import { createRecordCache, openRecords, openRecordsSync, type RecordChange } from './records';
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

  it('opens empty and never writes while the read keeps failing', async () => {
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

  it('resolves flush true when every write lands, or nothing was queued', async () => {
    const cache = await openRecords({ storage: createMemoryAdapter(), prefix: PREFIX });
    expect(await cache.flush()).toBe(true);
    cache.set('layout', { a: 1 });
    cache.delete('layout');
    cache.set('other', 1);
    expect(await cache.flush()).toBe(true);
  });

  it('resolves flush false when a write throws, keeping the value in memory', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failing: StorageAdapter = {
      ...createMemoryAdapter(),
      set: async () => {
        throw new Error('quota');
      },
    };
    const cache = await openRecords({ storage: failing, prefix: PREFIX });
    cache.set('layout', { a: 1 });
    expect(await cache.flush()).toBe(false);
    expect(cache.get('layout')).toEqual({ a: 1 });
    warn.mockRestore();
  });

  it('resolves flush false when it cannot write and writes were queued', async () => {
    const cache = createRecordCache({ storage: createMemoryAdapter(), prefix: PREFIX, writable: false });
    expect(await cache.flush()).toBe(true);
    cache.set('layout', { a: 1 });
    expect(await cache.flush()).toBe(false);
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

describe('openRecordsSync', () => {
  it('holds every record under the prefix, names stripped, with no await', async () => {
    const backing = new Map<string, unknown>([['p.a', 1], ['p.b', 2], ['q.c', 3]]);
    const cache = openRecordsSync({ storage: createMemoryAdapter(backing), prefix: 'p.' });
    expect(cache.writable).toBe(true);
    expect(cache.entries().sort()).toEqual([['a', 1], ['b', 2]]);
    await cache.close();
  });

  it('opens empty and read-only when the synchronous read throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const storage = {
      ...createMemoryAdapter(),
      listSync: () => {
        throw new Error('no');
      },
    };
    const cache = openRecordsSync({ storage, prefix: 'p.' });
    expect(cache.writable).toBe(false);
    expect(cache.entries()).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[storage]'), expect.any(Error));
    await cache.close();
    warn.mockRestore();
  });

  it('writes through to the adapter', async () => {
    const backing = new Map<string, unknown>();
    const cache = openRecordsSync({ storage: createMemoryAdapter(backing), prefix: 'p.' });
    cache.set('a', 5);
    await cache.flush();
    expect(backing.get('p.a')).toBe(5);
    await cache.close();
  });
});

/** An adapter over `backing` whose first `failures` lists fail. */
function awayAtFirst(backing: Map<string, unknown>, failures = 1) {
  const memory = createMemoryAdapter(backing);
  let left = failures;
  const fail = () => {
    if (left-- > 0) throw new Error('server away');
  };
  const list = vi.fn(async (prefix: string) => {
    fail();
    return memory.list(prefix);
  });
  const listSync = vi.fn((prefix: string) => {
    fail();
    return memory.listSync(prefix);
  });
  return { storage: { ...memory, list, listSync }, list, listSync };
}

describe('a first read that fails', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    vi.useFakeTimers();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    warn.mockRestore();
  });

  it('is tried again, and what lands is held, reported as remote, and writable', async () => {
    const backing = new Map<string, unknown>([['lk:t:a', 1], ['lk:t:b', 2]]);
    const { storage } = awayAtFirst(backing);
    const cache = await openRecords({ storage, prefix: PREFIX });
    expect(cache.writable).toBe(false);
    expect(cache.entries()).toEqual([]);
    const heard: RecordChange[][] = [];
    cache.subscribe((c) => heard.push(c));

    await vi.advanceTimersByTimeAsync(1000);
    expect(cache.writable).toBe(true);
    expect(cache.get('a')).toBe(1);
    expect(heard).toEqual([
      [
        { name: 'a', value: 1, origin: 'remote' },
        { name: 'b', value: 2, origin: 'remote' },
      ],
    ]);

    cache.set('c', 3);
    await cache.flush();
    expect(backing.get('lk:t:c')).toBe(3);
    await createMemoryAdapter(backing).set('lk:t:d', 4);
    await tick();
    expect(cache.get('d')).toBe(4);
    await cache.close();
  });

  it('recovers a cache opened synchronously', async () => {
    const backing = new Map<string, unknown>([['lk:t:a', 1]]);
    const { storage } = awayAtFirst(backing);
    const cache = openRecordsSync({ storage, prefix: PREFIX });
    expect(cache.writable).toBe(false);
    const heard: RecordChange[] = [];
    cache.subscribe((c) => heard.push(...c));
    await vi.advanceTimersByTimeAsync(1000);
    expect(cache.writable).toBe(true);
    expect(heard).toEqual([{ name: 'a', value: 1, origin: 'remote' }]);
    await createMemoryAdapter(backing).set('lk:t:d', 4);
    await tick();
    expect(cache.get('d')).toBe(4);
    await cache.close();
  });

  it('backs off, doubling up to the cap', async () => {
    const { storage, list } = awayAtFirst(new Map(), Infinity);
    const cache = await openRecords({ storage, prefix: PREFIX, retryMs: 100, retryMaxMs: 400 });
    const callsAt = async (ms: number) => {
      await vi.advanceTimersByTimeAsync(ms - Date.now());
      return list.mock.calls.length;
    };
    vi.setSystemTime(0);
    expect(await callsAt(99)).toBe(1);
    expect(await callsAt(100)).toBe(2);
    expect(await callsAt(299)).toBe(2);
    expect(await callsAt(300)).toBe(3);
    expect(await callsAt(700)).toBe(4);
    expect(await callsAt(1099)).toBe(4);
    expect(await callsAt(1100)).toBe(5);
    expect(warn).toHaveBeenCalledTimes(1);
    await cache.close();
  });

  it('lets writes made meanwhile win over what lands, and sends them', async () => {
    const backing = new Map<string, unknown>([['lk:t:a', 1], ['lk:t:b', 2], ['lk:t:gone', 9]]);
    const { storage } = awayAtFirst(backing);
    const cache = await openRecords({ storage, prefix: PREFIX });
    const heard: RecordChange[] = [];
    cache.subscribe((c) => heard.push(...c));
    cache.set('a', 'mine');
    cache.delete('gone');
    await vi.advanceTimersByTimeAsync(999);
    expect(backing.get('lk:t:a')).toBe(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(cache.get('a')).toBe('mine');
    expect(cache.has('gone')).toBe(false);
    expect(heard).toEqual([
      { name: 'a', value: 'mine', origin: 'local' },
      { name: 'gone', value: undefined, origin: 'local' },
      { name: 'b', value: 2, origin: 'remote' },
    ]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(backing.get('lk:t:a')).toBe('mine');
    expect(backing.has('lk:t:gone')).toBe(false);
    expect(backing.get('lk:t:b')).toBe(2);
    await cache.close();
  });

  it('stays read-only once its opener stops writing', async () => {
    const backing = new Map<string, unknown>([['lk:t:a', 1]]);
    const { storage, list } = awayAtFirst(backing);
    const cache = await openRecords({ storage, prefix: PREFIX });
    cache.stopWriting();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await cache.read()).toBe(false);
    expect(list).toHaveBeenCalledTimes(1);
    expect(cache.writable).toBe(false);
    cache.set('c', 3);
    await vi.advanceTimersByTimeAsync(5000);
    expect(backing.has('lk:t:c')).toBe(false);
  });

  it('stays read-only when a listener stops writing over what landed', async () => {
    const backing = new Map<string, unknown>([['lk:t:a', 1]]);
    const { storage } = awayAtFirst(backing);
    const cache = await openRecords({ storage, prefix: PREFIX });
    cache.set('c', 3);
    cache.subscribe((changes) => {
      if (changes.some((c) => c.origin === 'remote')) cache.stopWriting();
    });
    await vi.advanceTimersByTimeAsync(5000);
    expect(cache.get('a')).toBe(1);
    expect(cache.writable).toBe(false);
    expect(backing.has('lk:t:c')).toBe(false);
  });

  it('stops trying once closed', async () => {
    const { storage, list } = awayAtFirst(new Map(), Infinity);
    const cache = await openRecords({ storage, prefix: PREFIX });
    await cache.close();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('does not try again with retrying off, until asked to read', async () => {
    const backing = new Map<string, unknown>([['lk:t:a', 1]]);
    const { storage, list } = awayAtFirst(backing, 2);
    const cache = await openRecords({ storage, prefix: PREFIX, retryMs: false });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(list).toHaveBeenCalledTimes(1);
    expect(cache.writable).toBe(false);

    expect(await cache.read()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    expect(await cache.read()).toBe(true);
    expect(cache.writable).toBe(true);
    expect(cache.get('a')).toBe(1);
    await cache.close();
  });

  it('reads at once when asked, ahead of the backoff', async () => {
    const backing = new Map<string, unknown>([['lk:t:a', 1]]);
    const { storage } = awayAtFirst(backing);
    const cache = await openRecords({ storage, prefix: PREFIX });
    expect(await cache.read()).toBe(true);
    expect(cache.get('a')).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
    await cache.close();
  });
});
