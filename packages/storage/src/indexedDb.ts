import type { StorageAdapter, StorageChange } from './types';

/** Options for `createIndexedDbAdapter`. */
export interface IndexedDbAdapterOptions {
  /** Default `'weasel'`. */
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
    const mine = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('[storage] IndexedDB is not available here'));
        return;
      }
      // No `onblocked`: a blocked open is still pending, and lands once the
      // connections in its way close.
      const request = indexedDB.open(database, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(store)) {
          request.result.createObjectStore(store);
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(store)) {
          db.close();
          reject(new Error(`[storage] IndexedDB database "${database}" has no store "${store}"`));
          return;
        }
        connection = db;
        // The browser closing the connection: site data cleared, or evicted.
        db.onclose = () => forget(db);
        // Another connection wants to delete or upgrade the database, and
        // waits for as long as this one stays open.
        db.onversionchange = () => {
          db.close();
          forget(db);
        };
        resolve(db);
      };
      request.onerror = () => reject(request.error);
    });
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

  let channel: NodeChannel | null = null;
  const getChannel = (): NodeChannel | null => {
    if (typeof BroadcastChannel === 'undefined') return null;
    if (!channel) {
      channel = new BroadcastChannel(`weasel-storage:${database}:${store}`) as NodeChannel;
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
