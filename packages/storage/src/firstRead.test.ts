import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryAdapter } from './memory';
import { createRecordCache, openRecords, openRecordsSync } from './records';
import type { SyncStorageAdapter } from './types';
import { localStorageAdapter } from './webStorage';

/** A memory adapter whose first `blocked` calls to `subscribe` and `listSync` throw, as a blocked substrate does. */
function blockedAtFirst(backing: Map<string, unknown>, blocked: number): SyncStorageAdapter {
  const inner = createMemoryAdapter(backing);
  let subscribes = 0;
  let lists = 0;
  return {
    ...inner,
    listSync: (prefix) => {
      if (lists++ < blocked) throw new DOMException('blocked', 'SecurityError');
      return inner.listSync(prefix);
    },
    subscribe: (prefix, on) => {
      if (subscribes++ < blocked) throw new DOMException('blocked', 'SecurityError');
      return inner.subscribe!(prefix, on);
    },
  };
}

describe('a first read whose subscribe throws', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('opens the cache empty and read-only, and reads it on a later try', async () => {
    const cache = await openRecords({ storage: blockedAtFirst(new Map([['p:a', 1]]), 1), prefix: 'p:' });
    expect(cache.writable).toBe(false);
    expect(cache.entries()).toEqual([]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(cache.writable).toBe(true);
    expect(cache.get('a')).toBe(1);
    await cache.close();
  });

  it('keeps retrying a cache opened synchronously', async () => {
    const cache = openRecordsSync({ storage: blockedAtFirst(new Map([['p:a', 1]]), 1), prefix: 'p:' });
    expect(cache.writable).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(cache.writable).toBe(false);
    await vi.advanceTimersByTimeAsync(2000);
    expect(cache.get('a')).toBe(1);
    await cache.close();
  });
});

describe('localStorageAdapter where the browser refuses site data', () => {
  afterEach(() => vi.restoreAllMocks());

  it('subscribes without throwing, and a cache over it opens empty and read-only', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    const stop = localStorageAdapter.subscribe!('p:', () => {});
    stop();
    const made = createRecordCache({ storage: localStorageAdapter, prefix: 'p:', retryMs: false });
    await made.close();
    const cache = await openRecords({ storage: localStorageAdapter, prefix: 'p:', retryMs: false });
    expect(cache.writable).toBe(false);
    await cache.close();
  });
});
