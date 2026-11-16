import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryAdapter } from './memory';
import { openRecords } from './records';

const PREFIX = 'lk:t:';
const LONG = 2 ** 31;

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('waits longer than one timer holds', () => {
  it('holds a write for the whole debounce', async () => {
    const backing = new Map<string, unknown>();
    const cache = await openRecords({ storage: createMemoryAdapter(backing), prefix: PREFIX, debounceMs: LONG, maxWaitMs: LONG });
    cache.set('mode', 'light');
    await vi.advanceTimersByTimeAsync(1);
    expect(backing.has('lk:t:mode')).toBe(false);
    await vi.advanceTimersByTimeAsync(LONG);
    expect(backing.get('lk:t:mode')).toBe('light');
  });

  it('sends a rejected write again only once the retry wait is up', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const memory = createMemoryAdapter(new Map());
    const set = vi.fn(async () => { throw new Error('server restarting'); });
    const cache = await openRecords({ storage: { ...memory, set }, prefix: PREFIX, retryMs: LONG, retryMaxMs: LONG });
    cache.set('mode', 'light');
    expect(await cache.flush()).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(set).toHaveBeenCalledTimes(1);
  });

  it('reads again only once the retry wait is up', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const memory = createMemoryAdapter(new Map());
    const list = vi.fn(async () => { throw new Error('server away'); });
    const cache = await openRecords({ storage: { ...memory, list }, prefix: PREFIX, retryMs: LONG, retryMaxMs: LONG });
    await vi.advanceTimersByTimeAsync(1);
    expect(list).toHaveBeenCalledTimes(1);
    await cache.close();
  });
});
