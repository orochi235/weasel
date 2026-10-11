import { isJsonSafe, parse } from './json';
import type { SyncStorageAdapter } from './types';

function webStorageAdapter(area: () => Storage, name: string, crossTab: boolean): SyncStorageAdapter {
  const warned = new Set<string>();
  const keysNow = (prefix: string): string[] => {
    const store = area();
    const out: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key?.startsWith(prefix)) out.push(key);
    }
    return out;
  };
  const listNow = (prefix: string): [string, unknown][] => {
    const store = area();
    const out: [string, unknown][] = [];
    for (const key of keysNow(prefix)) {
      const raw = store.getItem(key);
      if (raw !== null) out.push([key, parse(raw)]);
    }
    return out;
  };
  // The keys each live subscription knows to exist. `clear()` in another tab
  // arrives as one event naming no key, so this is what says what went.
  const subscribers = new Set<{ prefix: string; keys: Set<string> }>();
  const note = (key: string, held: boolean): void => {
    for (const sub of subscribers) {
      if (!key.startsWith(sub.prefix)) continue;
      if (held) sub.keys.add(key);
      else sub.keys.delete(key);
    }
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
      note(key, true);
    },
    delete: async (key) => {
      area().removeItem(key);
      note(key, false);
    },
  };
  if (crossTab) {
    adapter.subscribe = (prefix, on) => {
      if (typeof window === 'undefined') return () => {};
      const sub = { prefix, keys: new Set(keysNow(prefix)) };
      subscribers.add(sub);
      const handler = (e: StorageEvent): void => {
        const store = area();
        if (e.storageArea !== store) return;
        if (e.key === null) {
          const gone = [...sub.keys].filter((key) => store.getItem(key) === null);
          for (const key of gone) sub.keys.delete(key);
          if (gone.length > 0) on(gone.map((key): [string, unknown] => [key, undefined]));
          return;
        }
        if (!e.key.startsWith(prefix)) return;
        if (e.newValue === null) sub.keys.delete(e.key);
        else sub.keys.add(e.key);
        on([[e.key, e.newValue === null ? undefined : parse(e.newValue)]]);
      };
      window.addEventListener('storage', handler);
      return () => {
        subscribers.delete(sub);
        window.removeEventListener('storage', handler);
      };
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
