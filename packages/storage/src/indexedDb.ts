import type { StorageAdapter, StorageChange } from './types';

/** Options for `createIndexedDbAdapter`. */
export interface IndexedDbAdapterOptions {
  /** Default `'weasel'`. */
  database?: string;
  /** Default `'records'`. A database that exists without this store gets it
   *  by an upgrade, which waits on other connections to it closing. */
  store?: string;
}

interface NodeChannel extends BroadcastChannel {
  unref?: () => void;
}

/** Every string key starting with `prefix`: up to, not including, the first string past them all. */
function prefixRange(prefix: string): IDBKeyRange {
  for (let i = prefix.length - 1; i >= 0; i--) {
    const unit = prefix.charCodeAt(i);
    if (unit < 0xffff) return IDBKeyRange.bound(prefix, prefix.slice(0, i) + String.fromCharCode(unit + 1), false, true);
  }
  return IDBKeyRange.lowerBound(prefix);
}

/** The channel named `name`, opened on first call; null where there is no `BroadcastChannel`. */
function lazyChannel(name: string): () => NodeChannel | null {
  let channel: NodeChannel | null = null;
  return () => {
    if (typeof BroadcastChannel === 'undefined') return null;
    if (!channel) {
      channel = new BroadcastChannel(name) as NodeChannel;
      // Node keeps its event loop alive for an open channel; a browser has no unref.
      channel.unref?.();
    }
    return channel;
  };
}

/** `database` at `version`, or at whatever version it has when omitted, with `store` created by an
 *  upgrade. Answers the version it opened at instead when that has no `store`, since only an upgrade
 *  past it can create one. */
function request(database: string, store: string, version: number | undefined): Promise<IDBDatabase | number> {
  return new Promise((resolve, reject) => {
    const req = version === undefined ? indexedDB.open(database) : indexedDB.open(database, version);
    // A blocked open is still pending, and lands once the connections in its way close; until then nothing
    // this adapter holds reads or writes, so say why.
    req.onblocked = () => {
      console.warn(`[storage] IndexedDB database "${database}" waits for another tab to close it before it can add the store "${store}"`);
    };
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(store)) req.result.createObjectStore(store);
    };
    req.onsuccess = () => {
      const db = req.result;
      if (db.objectStoreNames.contains(store)) {
        resolve(db);
        return;
      }
      db.close();
      resolve(db.version);
    };
    req.onerror = () => reject(req.error);
  });
}

/** A connection to `database` holding `store`, upgrading the database one version to create it. */
async function openWithStore(database: string, store: string): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') throw new Error('[storage] IndexedDB is not available here');
  let db = await request(database, store, undefined);
  // Another connection upgrading first makes the version stale, so a few tries.
  for (let tries = 0; typeof db === 'number' && tries < 3; tries++) {
    db = await request(database, store, db + 1).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'VersionError') return request(database, store, undefined);
      throw error;
    });
  }
  if (typeof db === 'number') {
    throw new Error(`[storage] IndexedDB database "${database}" would not take a store "${store}"`);
  }
  return db;
}

/** Persist to IndexedDB, which stores structured-clone values natively — typed
 *  arrays, `Map`s, `Blob`s — and holds far more than localStorage. Other tabs
 *  hear writes through a `BroadcastChannel`. The database opens on first use. */
export function createIndexedDbAdapter({
  database = 'weasel',
  store = 'records',
}: IndexedDbAdapterOptions = {}): StorageAdapter {
  let opened: Promise<IDBDatabase> | null = null;
  let connection: IDBDatabase | null = null;
  const forget = (db: IDBDatabase): void => {
    if (connection !== db) return;
    connection = null;
    opened = null;
  };
  const open = (): Promise<IDBDatabase> => {
    if (opened) return opened;
    const mine = (async (): Promise<IDBDatabase> => {
      const live = await openWithStore(database, store);
      connection = live;
      // The browser closing the connection: site data cleared, or evicted.
      live.onclose = () => forget(live);
      // Another connection wants to delete or upgrade the database, and
      // waits for as long as this one stays open.
      live.onversionchange = () => {
        live.close();
        forget(live);
      };
      return live;
    })();
    opened = mine;
    // A failed open is not kept, so the next call tries again.
    mine.catch(() => {
      if (opened === mine) opened = null;
    });
    return mine;
  };

  const run = async <T>(
    mode: IDBTransactionMode,
    body: (s: IDBObjectStore) => () => T,
  ): Promise<T> => {
    let db = await open();
    let tx: IDBTransaction;
    try {
      tx = db.transaction(store, mode);
    } catch {
      // A connection that closed without saying so. One more, on a new one.
      forget(db);
      db = await open();
      tx = db.transaction(store, mode);
    }
    return new Promise<T>((resolve, reject) => {
      const result = body(tx.objectStore(store));
      tx.oncomplete = () => resolve(result());
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  };

  const getChannel = lazyChannel(`weasel-storage:${database}:${store}`);
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
        const range = prefixRange(prefix);
        const keys = s.getAllKeys(range);
        const values = s.getAll(range);
        return () =>
          keys.result.map((key, i): [string, unknown] => [String(key), values.result[i]]);
      }),
    set: async (key, value) => {
      if (value === undefined) return adapter.delete(key);
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
