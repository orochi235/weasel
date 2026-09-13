import { decodeUrlHash, encodeUrlHash } from './helpers';
import type { StorageAdapter, StorageChange } from './types';

/** JSON-backed substrates held raw strings before records existed — a theme
 *  bucket stored `dark`, not `"dark"` — so an unparseable value comes back as
 *  the string it is. */
function parse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** Whether `JSON.stringify` would keep `value` exactly. An object key holding
 *  `undefined` counts as kept: JSON drops the key, and reading back an absent
 *  key yields the same `undefined`. */
function isJsonSafe(value: unknown, seen: Set<object> = new Set()): boolean {
  if (value === null) return true;
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return true;
    case 'number':
      return Number.isFinite(value);
    case 'object': {
      if (seen.has(value)) return false;
      seen.add(value);
      const proto = Object.getPrototypeOf(value);
      const ok = Array.isArray(value)
        ? value.every((v) => isJsonSafe(v, seen))
        : (proto === Object.prototype || proto === null) &&
          Object.values(value).every((v) => v === undefined || isJsonSafe(v, seen));
      seen.delete(value);
      return ok;
    }
    default:
      return false;
  }
}

function webStorageAdapter(area: () => Storage, name: string, crossTab: boolean): StorageAdapter {
  const warned = new Set<string>();
  const adapter: StorageAdapter = {
    get: async (key) => {
      const raw = area().getItem(key);
      return raw === null ? undefined : parse(raw);
    },
    list: async (prefix) => {
      const store = area();
      const out: [string, unknown][] = [];
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i);
        if (key === null || !key.startsWith(prefix)) continue;
        const raw = store.getItem(key);
        if (raw !== null) out.push([key, parse(raw)]);
      }
      return out;
    },
    set: async (key, value) => {
      if (!warned.has(key) && !isJsonSafe(value)) {
        warned.add(key);
        console.warn(
          `[labkit] "${key}" holds a value JSON cannot keep exactly; ${name} stores what JSON keeps. Use IndexedDB for binary or non-JSON state.`,
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
export const localStorageAdapter: StorageAdapter = webStorageAdapter(
  () => localStorage,
  'localStorage',
  true,
);

/** Persist to `sessionStorage` — survives a reload but not a new tab. */
export const sessionStorageAdapter: StorageAdapter = webStorageAdapter(
  () => sessionStorage,
  'sessionStorage',
  false,
);

const URL_HASH_GUARD = typeof window !== 'undefined';

function readHashMap(): Record<string, string> {
  if (!URL_HASH_GUARD) return {};
  const raw = decodeUrlHash(window.location.hash.replace(/^#/, ''));
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

/** What each live subscription last saw, refreshed on this page's own writes
 *  so `hashchange` reports only somebody else's. */
const hashSubscribers = new Set<{ last: Record<string, string> }>();

function writeHashMap(map: Record<string, string>): void {
  if (!URL_HASH_GUARD) return;
  const encoded = encodeUrlHash(JSON.stringify(map));
  window.history.replaceState(null, '', `#${encoded}`);
  for (const sub of hashSubscribers) sub.last = { ...map };
}

/** Persist into the URL fragment, so the page's link carries its state and can
 *  be shared or bookmarked. Changes to the fragment made elsewhere — a pasted
 *  link, back and forward — arrive through `hashchange`. */
export const urlHashAdapter: StorageAdapter = {
  get: async (key) => {
    const raw = readHashMap()[key];
    return raw === undefined ? undefined : parse(raw);
  },
  list: async (prefix) =>
    Object.entries(readHashMap())
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, raw]): [string, unknown] => [key, parse(raw)]),
  set: async (key, value) => {
    const map = readHashMap();
    map[key] = JSON.stringify(value);
    writeHashMap(map);
  },
  delete: async (key) => {
    const map = readHashMap();
    delete map[key];
    writeHashMap(map);
  },
  subscribe: (prefix, on) => {
    if (!URL_HASH_GUARD) return () => {};
    const sub = { last: readHashMap() };
    hashSubscribers.add(sub);
    const handler = (): void => {
      const next = readHashMap();
      const changes: StorageChange[] = [];
      for (const key of new Set([...Object.keys(sub.last), ...Object.keys(next)])) {
        if (!key.startsWith(prefix) || sub.last[key] === next[key]) continue;
        const raw = next[key];
        changes.push([key, raw === undefined ? undefined : parse(raw)]);
      }
      sub.last = next;
      if (changes.length > 0) on(changes);
    };
    window.addEventListener('hashchange', handler);
    return () => {
      hashSubscribers.delete(sub);
      window.removeEventListener('hashchange', handler);
    };
  },
};

interface MemorySubscriber {
  owner: StorageAdapter;
  prefix: string;
  on: (changes: StorageChange[]) => void;
}

const memorySubscribers = new WeakMap<Map<string, unknown>, Set<MemorySubscriber>>();

/** An in-memory store, discarded on reload. Values are copied in and out, as a
 *  real substrate would. Adapters built over one shared `backing` hear each
 *  other's writes — two tabs, for a test. */
export function createMemoryAdapter(backing: Map<string, unknown> = new Map()): StorageAdapter {
  let subscribers = memorySubscribers.get(backing);
  if (!subscribers) {
    subscribers = new Set();
    memorySubscribers.set(backing, subscribers);
  }
  const peers = subscribers;
  const notify = (key: string, value: unknown): void => {
    for (const sub of peers) {
      if (sub.owner === adapter || !key.startsWith(sub.prefix)) continue;
      const copy = value === undefined ? undefined : structuredClone(value);
      queueMicrotask(() => sub.on([[key, copy]]));
    }
  };
  const adapter: StorageAdapter = {
    get: async (key) => (backing.has(key) ? structuredClone(backing.get(key)) : undefined),
    list: async (prefix) =>
      [...backing]
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, value]): [string, unknown] => [key, structuredClone(value)]),
    set: async (key, value) => {
      const copy = structuredClone(value);
      backing.set(key, copy);
      notify(key, copy);
    },
    delete: async (key) => {
      backing.delete(key);
      notify(key, undefined);
    },
    subscribe: (prefix, on) => {
      const sub = { owner: adapter, prefix, on };
      peers.add(sub);
      return () => {
        peers.delete(sub);
      };
    },
  };
  return adapter;
}

/** Persists nothing and reads back nothing. */
export const noneAdapter: StorageAdapter = {
  get: async () => undefined,
  list: async () => [],
  set: async () => {},
  delete: async () => {},
};

/** Options for `createIndexedDbAdapter`. */
export interface IndexedDbAdapterOptions {
  /** Default `'labkit'`. */
  database?: string;
  /** Default `'records'`. One object store per database: a store added to a
   *  database that already exists is not created. */
  store?: string;
}

interface NodeChannel extends BroadcastChannel {
  unref?: () => void;
}

/** Persist to IndexedDB, which stores structured-clone values natively — typed
 *  arrays, `Map`s, `Blob`s — and holds far more than localStorage. Other tabs
 *  hear writes through a `BroadcastChannel`. The database opens on first use. */
export function createIndexedDbAdapter({
  database = 'labkit',
  store = 'records',
}: IndexedDbAdapterOptions = {}): StorageAdapter {
  let opened: Promise<IDBDatabase> | null = null;
  const open = (): Promise<IDBDatabase> => {
    opened ??= new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('[labkit] IndexedDB is not available here'));
        return;
      }
      const request = indexedDB.open(database, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(store)) {
          request.result.createObjectStore(store);
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(store)) {
          reject(new Error(`[labkit] IndexedDB database "${database}" has no store "${store}"`));
          return;
        }
        resolve(db);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error(`[labkit] IndexedDB "${database}" is blocked`));
    });
    return opened;
  };

  const run = <T>(mode: IDBTransactionMode, body: (s: IDBObjectStore) => () => T): Promise<T> =>
    open().then(
      (db) =>
        new Promise<T>((resolve, reject) => {
          const tx = db.transaction(store, mode);
          const result = body(tx.objectStore(store));
          tx.oncomplete = () => resolve(result());
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        }),
    );

  let channel: NodeChannel | null = null;
  const getChannel = (): NodeChannel | null => {
    if (typeof BroadcastChannel === 'undefined') return null;
    if (!channel) {
      channel = new BroadcastChannel(`labkit:${database}:${store}`) as NodeChannel;
      // Node keeps its event loop alive for an open channel; a browser has no unref.
      channel.unref?.();
    }
    return channel;
  };
  const announce = (changes: StorageChange[]): void => {
    getChannel()?.postMessage(changes);
  };

  const adapter: StorageAdapter = {
    get: (key) =>
      run('readonly', (s) => {
        const request = s.get(key);
        return () => request.result as unknown;
      }),
    list: (prefix) =>
      run('readonly', (s) => {
        const range = IDBKeyRange.bound(prefix, `${prefix}￿`);
        const keys = s.getAllKeys(range);
        const values = s.getAll(range);
        return () =>
          keys.result.map((key, i): [string, unknown] => [String(key), values.result[i]]);
      }),
    set: async (key, value) => {
      await run('readwrite', (s) => {
        s.put(value, key);
        return () => undefined;
      });
      announce([[key, value]]);
    },
    delete: async (key) => {
      await run('readwrite', (s) => {
        s.delete(key);
        return () => undefined;
      });
      announce([[key, undefined]]);
    },
  };
  if (typeof BroadcastChannel !== 'undefined') {
    adapter.subscribe = (prefix, on) => {
      const ch = getChannel();
      if (!ch) return () => {};
      const handler = (e: MessageEvent<StorageChange[]>): void => {
        const mine = e.data.filter(([key]) => key.startsWith(prefix));
        if (mine.length > 0) on(mine);
      };
      ch.addEventListener('message', handler);
      return () => ch.removeEventListener('message', handler);
    };
  }
  return adapter;
}

/** IndexedDB under the default database and store. */
export const indexedDbAdapter: StorageAdapter = createIndexedDbAdapter();

let resolvedDefault: Promise<StorageAdapter> | null = null;

/** What a lab given only a `storageKey` persists to: IndexedDB, or
 *  localStorage — with a warning — where IndexedDB will not open. */
export function defaultStorage(): Promise<StorageAdapter> {
  resolvedDefault ??= indexedDbAdapter.list(' ').then(
    () => indexedDbAdapter,
    (error) => {
      console.warn('[labkit] IndexedDB would not open; persisting to localStorage instead', error);
      return localStorageAdapter;
    },
  );
  return resolvedDefault;
}

/** Forget which default was chosen. Tests only. */
export function resetDefaultStorage(): void {
  resolvedDefault = null;
}
