import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { describeAdapterContract } from './adapterContract';
import {
  createIndexedDbAdapter,
  createMemoryAdapter,
  defaultStorage,
  indexedDbAdapter,
  localStorageAdapter,
  noneAdapter,
  resetDefaultStorage,
  sessionStorageAdapter,
  urlHashAdapter,
} from './adapters';
import { decodeUrlHash, encodeUrlHash } from './helpers';

describeAdapterContract('createMemoryAdapter', () => {
  const backing = new Map<string, unknown>();
  const peer = createMemoryAdapter(backing);
  return { adapter: createMemoryAdapter(backing), binary: true, foreign: peer };
});

let database = 0;
describeAdapterContract('createIndexedDbAdapter', () => {
  const name = `contract-${database++}`;
  return {
    adapter: createIndexedDbAdapter({ database: name }),
    binary: true,
    foreign: createIndexedDbAdapter({ database: name }),
  };
});

/** jsdom has one window, so no `storage` event ever arrives from another tab.
 *  This writes the key and dispatches the event another tab's write would —
 *  a stand-in for the browser, not a test of it. */
function foreignWebStorage(area: Storage) {
  const fire = (key: string, newValue: string | null): void => {
    window.dispatchEvent(new StorageEvent('storage', { key, newValue, storageArea: area }));
  };
  return {
    set: (key: string, value: unknown) => {
      const raw = JSON.stringify(value);
      area.setItem(key, raw);
      fire(key, raw);
    },
    delete: (key: string) => {
      area.removeItem(key);
      fire(key, null);
    },
  };
}

describeAdapterContract('localStorageAdapter', () => {
  localStorage.clear();
  return { adapter: localStorageAdapter, binary: false, foreign: foreignWebStorage(localStorage) };
});

describeAdapterContract('sessionStorageAdapter', () => {
  sessionStorage.clear();
  return { adapter: sessionStorageAdapter, binary: false };
});

function foreignHash() {
  const edit = (change: (map: Record<string, string>) => void): void => {
    const raw = decodeUrlHash(window.location.hash.replace(/^#/, ''));
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    change(map);
    window.location.hash = encodeUrlHash(JSON.stringify(map));
  };
  return {
    set: (key: string, value: unknown) =>
      edit((map) => {
        map[key] = JSON.stringify(value);
      }),
    delete: (key: string) =>
      edit((map) => {
        delete map[key];
      }),
  };
}

describeAdapterContract('urlHashAdapter', () => {
  window.history.replaceState(null, '', '#');
  return { adapter: urlHashAdapter, binary: false, foreign: foreignHash() };
});

describe('localStorageAdapter', () => {
  beforeEach(() => localStorage.clear());

  it('reads a value stored before records existed, raw or JSON', async () => {
    localStorage.setItem('lk:old:theme', 'dark');
    localStorage.setItem('lk:old:doc', '{"version":3}');
    expect(await localStorageAdapter.get('lk:old:theme')).toBe('dark');
    expect(await localStorageAdapter.get('lk:old:doc')).toEqual({ version: 3 });
  });

  it('rejects a write that does not land', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('QuotaExceeded', 'QuotaExceededError');
    });
    await expect(localStorageAdapter.set('k', 'v')).rejects.toThrow('QuotaExceeded');
  });

  it('warns once per key when JSON would change the value, and stores what JSON keeps', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await localStorageAdapter.set('lk:w:a', { at: new Set([1]) });
    await localStorageAdapter.set('lk:w:a', { at: new Set([2]) });
    await localStorageAdapter.set('lk:w:b', { fine: [1, 'x', null], skipped: undefined });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(await localStorageAdapter.get('lk:w:a')).toEqual({ at: {} });
    warn.mockRestore();
  });
});

describe('noneAdapter', () => {
  it('stores nothing', async () => {
    await noneAdapter.set('k', 'v');
    expect(await noneAdapter.get('k')).toBeUndefined();
    expect(await noneAdapter.list('')).toEqual([]);
  });
});

describe('defaultStorage', () => {
  afterEach(() => {
    resetDefaultStorage();
    vi.unstubAllGlobals();
  });

  it('is IndexedDB where it opens', async () => {
    expect(await defaultStorage()).toBe(indexedDbAdapter);
  });

  it('falls back to localStorage, with a warning, where it will not', async () => {
    vi.stubGlobal('indexedDB', undefined);
    // The shared adapter may already hold an open database from the case above.
    vi.resetModules();
    const fresh = await import('./adapters');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await fresh.defaultStorage()).toBe(fresh.localStorageAdapter);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('IndexedDB would not open'),
      expect.anything(),
    );
    warn.mockRestore();
  });
});
