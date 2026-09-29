import { describe, it, expect, vi } from 'vitest';
import { createRecentColorsStore, type RecentColorsStorage } from './recentColors';

function memoryStorage(initial: Record<string, string> = {}): RecentColorsStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = v; },
  };
}

describe('createRecentColorsStore', () => {
  it('puts the most recent color first', () => {
    const store = createRecentColorsStore({ storage: null });
    store.record('#ff0000ff');
    store.record('#00ff00ff');
    store.record('#0000ffff');
    expect(store.get()).toEqual(['#0000ffff', '#00ff00ff', '#ff0000ff']);
  });

  it('moves a repeated color to the head instead of listing it twice', () => {
    const store = createRecentColorsStore({ storage: null });
    store.record('#ff0000ff');
    store.record('#00ff00ff');
    store.record('#ff0000ff');
    expect(store.get()).toEqual(['#ff0000ff', '#00ff00ff']);
  });

  it('dedupes spellings of one color', () => {
    const store = createRecentColorsStore({ storage: null });
    store.record('#F00');
    store.record('#ff0000');
    store.record('#FF0000FF');
    expect(store.get()).toEqual(['#ff0000ff']);
  });

  it('caps the list, dropping the oldest', () => {
    const store = createRecentColorsStore({ storage: null, limit: 3 });
    for (const c of ['#111111', '#222222', '#333333', '#444444']) store.record(c);
    expect(store.get()).toEqual(['#444444ff', '#333333ff', '#222222ff']);
  });

  it('defaults the cap to 12', () => {
    const store = createRecentColorsStore({ storage: null });
    for (let i = 0; i < 20; i++) store.record(`#0000${i.toString(16).padStart(2, '0')}`);
    expect(store.get()).toHaveLength(12);
    expect(store.get()[0]).toBe('#000013ff');
  });

  it('records several colors at once in the order given, like a gradient stop list', () => {
    const store = createRecentColorsStore({ storage: null });
    store.record('#ffffffff');
    store.record(['#ff0000ff', '#0000ffff', '#ff0000ff']);
    expect(store.get()).toEqual(['#ff0000ff', '#0000ffff', '#ffffffff']);
  });

  it('ignores empty strings, and does not notify when nothing changed', () => {
    const store = createRecentColorsStore({ storage: null });
    store.record('#ff0000ff');
    const listener = vi.fn();
    store.subscribe(listener);
    const before = store.get();
    store.record(['', '  ']);
    store.record('#ff0000ff');
    expect(listener).not.toHaveBeenCalled();
    expect(store.get()).toBe(before);
    store.record('#00ff00ff');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('persists to storage and reads it back', () => {
    const storage = memoryStorage();
    const a = createRecentColorsStore({ storage, key: 'k' });
    a.record('#ff0000ff');
    a.record('#00ff00ff');
    const b = createRecentColorsStore({ storage, key: 'k' });
    expect(b.get()).toEqual(['#00ff00ff', '#ff0000ff']);
  });

  it('discards a stored value that is not a list of colors', () => {
    expect(createRecentColorsStore({ storage: memoryStorage({ k: '{"x":1}' }), key: 'k' }).get()).toEqual([]);
    expect(createRecentColorsStore({ storage: memoryStorage({ k: 'not json' }), key: 'k' }).get()).toEqual([]);
    expect(createRecentColorsStore({ storage: memoryStorage({ k: '["#fff", 3]' }), key: 'k' }).get()).toEqual(['#ffffffff']);
  });

  it('keeps working in memory when storage throws', () => {
    const storage: RecentColorsStorage = {
      getItem: () => { throw new Error('SecurityError'); },
      setItem: () => { throw new Error('QuotaExceededError'); },
    };
    const store = createRecentColorsStore({ storage });
    expect(store.get()).toEqual([]);
    expect(() => store.record('#ff0000ff')).not.toThrow();
    expect(store.get()).toEqual(['#ff0000ff']);
  });

  it('works when the localStorage accessor itself throws', () => {
    const desc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => { throw new Error('SecurityError'); },
    });
    try {
      const store = createRecentColorsStore();
      store.record('#ff0000ff');
      expect(store.get()).toEqual(['#ff0000ff']);
    } finally {
      if (desc) Object.defineProperty(globalThis, 'localStorage', desc);
    }
  });

  it('clears', () => {
    const storage = memoryStorage();
    const store = createRecentColorsStore({ storage, key: 'k' });
    store.record('#ff0000ff');
    store.clear();
    expect(store.get()).toEqual([]);
    expect(createRecentColorsStore({ storage, key: 'k' }).get()).toEqual([]);
  });

  it('stops notifying after unsubscribe', () => {
    const store = createRecentColorsStore({ storage: null });
    const listener = vi.fn();
    const off = store.subscribe(listener);
    store.record('#ff0000ff');
    off();
    store.record('#00ff00ff');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
