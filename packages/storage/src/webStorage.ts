import { isJsonSafe, parse } from './json';
import type { SyncStorageAdapter } from './types';

function webStorageAdapter(area: () => Storage, name: string, crossTab: boolean): SyncStorageAdapter {
  const warned = new Set<string>();
  const listNow = (prefix: string): [string, unknown][] => {
    const store = area();
    const out: [string, unknown][] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key === null || !key.startsWith(prefix)) continue;
      const raw = store.getItem(key);
      if (raw !== null) out.push([key, parse(raw)]);
    }
    return out;
  };
  const adapter: SyncStorageAdapter = {
    get: async (key) => {
      const raw = area().getItem(key);
      return raw === null ? undefined : parse(raw);
    },
    list: async (prefix) => listNow(prefix),
    listSync: listNow,
    set: async (key, value) => {
      if (!warned.has(key) && !isJsonSafe(value)) {
        warned.add(key);
        console.warn(
          `[storage] "${key}" holds a value JSON cannot keep exactly; ${name} stores what JSON keeps. Use IndexedDB for binary or non-JSON state.`,
        );
      }
      area().setItem(key, JSON.stringify(value));
    },
    delete: async (key) => {
      area().removeItem(key);
    },
  };
  if (crossTab) {
    adapter.subscribe = (prefix, on) => {
      if (typeof window === 'undefined') return () => {};
      const handler = (e: StorageEvent): void => {
        if (e.key === null || !e.key.startsWith(prefix)) return;
        if (e.storageArea !== area()) return;
        on([[e.key, e.newValue === null ? undefined : parse(e.newValue)]]);
      };
      window.addEventListener('storage', handler);
      return () => window.removeEventListener('storage', handler);
    };
  }
  return adapter;
}

/** Persist to `localStorage`, one JSON value per record. Survives a reload and
 *  reaches other tabs through the `storage` event. */
export const localStorageAdapter: SyncStorageAdapter = webStorageAdapter(
  () => localStorage,
  'localStorage',
  true,
);

/** Persist to `sessionStorage` — survives a reload but not a new tab. */
export const sessionStorageAdapter: SyncStorageAdapter = webStorageAdapter(
  () => sessionStorage,
  'sessionStorage',
  false,
);
