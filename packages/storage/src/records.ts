import type { StorageAdapter, StorageChange, SyncStorageAdapter } from './types';

/** One record changing, as a cache listener hears it. `value` is `undefined`
 *  for a delete. `local` changes were made through this cache; `remote` ones
 *  came from another writer. */
export interface RecordChange {
  name: string;
  value: unknown;
  origin: 'local' | 'remote';
}

/**
 * Every record under one prefix, held in memory: the only thing that talks to
 * a `StorageAdapter`. Names are keys with the prefix removed.
 *
 * Writes land in memory at once and reach storage on a debounce. The newest
 * write to a record wins: another writer's change to a record with a write
 * still queued here is ignored, since the queued write lands after it.
 */
export interface RecordCache {
  readonly prefix: string;
  /** False while writing is off, so nothing here can overwrite the records:
   *  until a first read that failed lands on a later try, and for good once
   *  the opener marks them read-only. */
  readonly writable: boolean;
  has(name: string): boolean;
  get(name: string): unknown;
  /** Every record whose name starts with `namePrefix`. */
  entries(namePrefix?: string): [string, unknown][];
  set(name: string, value: unknown): void;
  delete(name: string): void;
  subscribe(listener: (changes: RecordChange[]) => void): () => void;
  /** Send queued writes now. Resolves true when every queued write landed or
   *  none was queued; false when a write threw (its value stays in memory) or
   *  writing is off and writes were queued. */
  flush(): Promise<boolean>;
  /** Try a failed first read again now, ahead of the backoff. Resolves
   *  whether the records have been read. */
  read(): Promise<boolean>;
  /** Send queued writes, stop hearing other writers, and stop retrying. */
  close(): Promise<void>;
}

/** The parts of a cache only its opener uses. */
export interface OwnedRecordCache extends RecordCache {
  /** Hold these records without writing them back. */
  seed(entries: Iterable<[string, unknown]>): void;
  stopWriting(): void;
}

/** Options for `createRecordCache` and `openRecords`. */
export interface RecordCacheOptions {
  storage: StorageAdapter;
  prefix: string;
  /** Trailing debounce on writes. Default 300 ms. */
  debounceMs?: number;
  /** The longest a write waits under continuous change. Default 1000 ms. */
  maxWaitMs?: number;
  /** The wait before a failed first read is tried again, doubling after each
   *  failure. Default 1000 ms; `false` never tries again on its own. */
  retryMs?: number | false;
  /** The longest wait between those tries. Default 30000 ms. */
  retryMaxMs?: number;
}

type CreateOptions = RecordCacheOptions & {
  initial?: Iterable<[string, unknown]>;
  writable?: boolean;
};

const DELETED = Symbol('deleted');

/** A cache holding `initial`, with nothing read from storage. */
export function createRecordCache(options: CreateOptions): OwnedRecordCache {
  return buildCache(options, false).cache;
}

/** `startUnread` leaves the cache waiting on a first read: `cache.read()`
 *  makes it, and `failed` reports one made elsewhere that threw. */
function buildCache(
  options: CreateOptions,
  startUnread: boolean,
): { cache: OwnedRecordCache; failed: (error: unknown) => void } {
  const { storage, prefix } = options;
  const debounceMs = options.debounceMs ?? 300;
  const maxWaitMs = options.maxWaitMs ?? 1000;
  const retryMs = options.retryMs ?? 1000;
  const retryMaxMs = options.retryMaxMs ?? 30_000;
  const values = new Map<string, unknown>(options.initial ?? []);
  const queued = new Map<string, unknown>();
  const listeners = new Set<(changes: RecordChange[]) => void>();
  // Two reasons writing is off. A read landing clears `unread`; nothing
  // clears `stopped`, which is the opener's choice.
  let unread = startUnread;
  let stopped = !(options.writable ?? true);
  const writable = (): boolean => !unread && !stopped;
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let firstQueuedAt: number | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryWait = retryMs === false ? 0 : retryMs;
  let reading: Promise<boolean> | null = null;
  let warned = false;

  const emit = (changes: RecordChange[]): void => {
    for (const listener of [...listeners]) listener(changes);
  };

  const schedule = (): void => {
    if (!writable() || closed) return;
    const now = Date.now();
    firstQueuedAt ??= now;
    if (timer) clearTimeout(timer);
    const wait = Math.max(0, Math.min(debounceMs, firstQueuedAt + maxWaitMs - now));
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, wait);
  };

  async function flush(): Promise<boolean> {
    if (timer) clearTimeout(timer);
    timer = null;
    firstQueuedAt = null;
    if (queued.size === 0) return true;
    if (!writable()) return false;
    const batch = [...queued];
    queued.clear();
    const landed = await Promise.all(
      batch.map(async ([name, value]) => {
        const key = prefix + name;
        try {
          if (value === DELETED) await storage.delete(key);
          else await storage.set(key, value);
          return true;
        } catch (error) {
          console.warn(`[storage] could not write "${key}"; keeping it in memory`, error);
          return false;
        }
      }),
    );
    return landed.every(Boolean);
  }

  const applyRemote = (changes: StorageChange[]): void => {
    const applied: RecordChange[] = [];
    for (const [key, value] of changes) {
      if (!key.startsWith(prefix)) continue;
      const name = key.slice(prefix.length);
      if (queued.has(name)) continue;
      if (value === undefined) {
        if (!values.has(name)) continue;
        values.delete(name);
      } else {
        values.set(name, value);
      }
      applied.push({ name, value, origin: 'remote' });
    }
    if (applied.length > 0) emit(applied);
  };

  let unsubscribe = writable() ? storage.subscribe?.(prefix, applyRemote) : undefined;

  const stopRetrying = (): void => {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
  };

  const failed = (error: unknown): void => {
    if (!warned) {
      warned = true;
      console.warn(
        `[storage] could not read "${prefix}"; opening empty and holding writes until a read lands`,
        error,
      );
    }
    if (retryMs === false || closed || stopped) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void read();
    }, retryWait);
    retryWait = Math.min(retryWait * 2, retryMaxMs);
  };

  async function attempt(): Promise<boolean> {
    stopRetrying();
    // Listen before listing, so a change landing between the two is not lost.
    const early: StorageChange[] = [];
    const stopEarly = storage.subscribe?.(prefix, (c) => early.push(...c));
    let listed: StorageChange[];
    try {
      listed = await storage.list(prefix);
    } catch (error) {
      stopEarly?.();
      failed(error);
      return false;
    }
    if (closed || stopped) {
      stopEarly?.();
      return false;
    }
    unread = false;
    unsubscribe = storage.subscribe?.(prefix, applyRemote);
    stopEarly?.();
    // Skips every name with a write queued while unread, so those win.
    applyRemote([...listed, ...early]);
    if (queued.size > 0) schedule();
    return true;
  }

  function read(): Promise<boolean> {
    if (!unread || stopped || closed) return Promise.resolve(!unread);
    reading ??= attempt().finally(() => {
      reading = null;
    });
    return reading;
  }

  const onPageHide = (): void => {
    void flush();
  };
  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') void flush();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);
  }

  const cache: OwnedRecordCache = {
    prefix,
    get writable() {
      return writable();
    },
    has: (name) => values.has(name),
    get: (name) => values.get(name),
    entries: (namePrefix = '') => [...values].filter(([name]) => name.startsWith(namePrefix)),
    set: (name, value) => {
      values.set(name, value);
      queued.set(name, value);
      emit([{ name, value, origin: 'local' }]);
      schedule();
    },
    delete: (name) => {
      // An unread cache cannot tell what storage holds, so it queues the delete.
      if (!unread && !values.has(name) && !queued.has(name)) return;
      values.delete(name);
      queued.set(name, DELETED);
      emit([{ name, value: undefined, origin: 'local' }]);
      schedule();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    flush,
    read,
    close: async () => {
      if (closed) return;
      stopRetrying();
      await flush();
      closed = true;
      unsubscribe?.();
      if (typeof window !== 'undefined') {
        window.removeEventListener('pagehide', onPageHide);
        document.removeEventListener('visibilitychange', onVisibility);
      }
    },
    seed: (entries) => {
      for (const [name, value] of entries) values.set(name, value);
    },
    stopWriting: () => {
      stopped = true;
      queued.clear();
      if (timer) clearTimeout(timer);
      timer = null;
      stopRetrying();
      unsubscribe?.();
    },
  };
  return { cache, failed };
}

/** Read every record under `prefix` and hold them. A failed read opens the
 *  cache empty with writing off, so it never overwrites what it could not
 *  read, and tries again on a backoff. When a read lands, the cache holds it,
 *  reports it as remote changes, and starts writing, sending first whatever
 *  was written meanwhile. */
export async function openRecords(options: RecordCacheOptions): Promise<OwnedRecordCache> {
  const { cache } = buildCache(options, true);
  await cache.read();
  return cache;
}

/** `openRecords` for an adapter that reads synchronously: the cache is ready
 *  on return. A failed read opens it empty with writing off, and it recovers
 *  the way `openRecords` does. */
export function openRecordsSync(
  options: RecordCacheOptions & { storage: SyncStorageAdapter },
): OwnedRecordCache {
  let listed: [string, unknown][];
  try {
    listed = options.storage.listSync(options.prefix);
  } catch (error) {
    const { cache, failed } = buildCache(options, true);
    failed(error);
    return cache;
  }
  const initial = listed.map(([key, value]): [string, unknown] => [
    key.slice(options.prefix.length),
    value,
  ]);
  return createRecordCache({ ...options, initial });
}
