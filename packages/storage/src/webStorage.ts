import { jsonLossWarner, parse, toJson } from './json';
import type { SyncStorageAdapter } from './types';

interface WebStorage {
  adapter: SyncStorageAdapter;
  readNow(key: string): unknown;
  writeNow(key: string, value: unknown): void;
}

function webStorage(area: () => Storage, name: string, crossTab: boolean): WebStorage {
  const warnLoss = jsonLossWarner(name);
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
  const readNow = (key: string): unknown => {
    const raw = area().getItem(key);
    return raw === null ? undefined : parse(raw);
  };
  const writeNow = (key: string, value: unknown): void => {
    if (value === undefined) {
      area().removeItem(key);
      note(key, false);
      return;
    }
    warnLoss(key, value);
    area().setItem(key, toJson(value));
    note(key, true);
  };
  const adapter: SyncStorageAdapter = {
    get: async (key) => readNow(key),
    list: async (prefix) => listNow(prefix),
    listSync: listNow,
    set: async (key, value) => writeNow(key, value),
    delete: async (key) => writeNow(key, undefined),
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
  return { adapter, readNow, writeNow };
}

const local = webStorage(() => localStorage, 'localStorage', true);

/** Persist to `localStorage`, one JSON value per record. Survives a reload and
 *  reaches other tabs through the `storage` event. */
export const localStorageAdapter: SyncStorageAdapter = local.adapter;

/** Persist to `sessionStorage` — survives a reload but not a new tab. */
export const sessionStorageAdapter: SyncStorageAdapter = webStorage(
  () => sessionStorage,
  'sessionStorage',
  false,
).adapter;

type StorageArea = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const warnAreaLoss = jsonLossWarner('Web Storage');

/** The value `localStorageAdapter` holds under `key`, read now, for a setting a first render needs: `undefined` when
 *  there is none, or where the browser refuses storage. Text stored as plain text, not JSON, reads back as itself.
 *  `area` reads another store shaped like `localStorage` the same way. */
export function readLocal(key: string, area?: StorageArea): unknown {
  try {
    if (!area) return local.readNow(key);
    const raw = area.getItem(key);
    return raw === null ? undefined : parse(raw);
  } catch {
    return undefined;
  }
}

/** Write `value` under `key` as `localStorageAdapter` would, now, `undefined` removing it. False where the browser
 *  refuses it: a private window, a full quota, or site data blocked. `area` writes another store shaped like
 *  `localStorage` the same way. */
export function writeLocal(key: string, value: unknown, area?: StorageArea): boolean {
  try {
    if (!area) local.writeNow(key, value);
    else if (value === undefined) area.removeItem(key);
    else {
      warnAreaLoss(key, value);
      area.setItem(key, toJson(value));
    }
    return true;
  } catch {
    return false;
  }
}
