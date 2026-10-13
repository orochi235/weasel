import type { StorageAdapter, StorageChange, SyncStorageAdapter } from './types';
import { DELETED, createWriteQueue } from './writeQueue';

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
 * still queued or on its way here is ignored, since that write lands after
 * it. A write storage rejects stays queued and is sent again on a backoff.
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
  /** `undefined` is no value a record can hold: setting it deletes. */
  set(name: string, value: unknown): void;
  delete(name: string): void;
  subscribe(listener: (changes: RecordChange[]) => void): () => void;
  /** Send queued writes now. Resolves true when every queued write landed or
   *  none was queued; false when a write threw (it stays queued) or writing
   *  is off and writes were queued. */
  flush(): Promise<boolean>;
  /** Try a failed first read again now, ahead of the backoff. Resolves
   *  whether the records have been read. */
  read(): Promise<boolean>;
  /** Resolves once the records have been read: at once for a cache that
   *  opened with them, and when a later read lands for one whose first read
   *  failed. Never resolves for a cache closed or stopped before that. */
  whenRead(): Promise<void>;
  /** Send queued writes, stop hearing other writers, and stop retrying. */
  close(): Promise<void>;
}

/** The parts of a cache only its opener uses. */
export interface OwnedRecordCache extends RecordCache {
  /** Hold these records without writing them back. */
  seed(entries: Iterable<[string, unknown]>): void;
  /** Hear another writer's changes this cache did not take, because its own
   *  write to the record was queued or on its way: each a name and the value
   *  the other writer set, `undefined` for a delete. */
  onOverruled(listener: (changes: [string, unknown][]) => void): () => void;
  stopWriting(): void;
}

/** Options for `openRecords`, and the part of `createRecordCache`'s the two share. */
export interface RecordCacheOptions {
  storage: StorageAdapter;
  prefix: string;
  /** Trailing debounce on writes. Default 300 ms. */
  debounceMs?: number;
  /** The longest a write waits under continuous change. Default 1000 ms. */
  maxWaitMs?: number;
  /** The wait before a failed first read, or a write storage rejected, is
   *  tried again, doubling after each failure. Default 1000 ms; `false` never
   *  tries again on its own, leaving a rejected write for the next flush. */
  retryMs?: number | false;
  /** The longest wait between those tries. Default 30000 ms. */
  retryMaxMs?: number;
}

/** Options for `createRecordCache`. */
export interface CreateRecordCacheOptions extends RecordCacheOptions {
  /** The records the cache opens holding, each a name and its value. Default none. */
  initial?: Iterable<[string, unknown]>;
  /** False opens the cache with writing off for good. Default true. */
  writable?: boolean;
}

/** A cache holding `initial`, with nothing read from storage. */
export function createRecordCache(options: CreateRecordCacheOptions): OwnedRecordCache {
  return buildCache(options, false).cache;
}

/** `startUnread` leaves the cache waiting on a first read: `cache.read()`
 *  makes it, and `failed` reports one made elsewhere that threw. */
function buildCache(
  options: CreateRecordCacheOptions,
  startUnread: boolean,
): { cache: OwnedRecordCache; failed: (error: unknown) => void } {
  const { storage, prefix } = options;
  const retryMs = options.retryMs ?? 1000;
  const retryMaxMs = options.retryMaxMs ?? 30_000;
  const values = new Map<string, unknown>(options.initial ?? []);
  const listeners = new Set<(changes: RecordChange[]) => void>();
  const overruledListeners = new Set<(changes: [string, unknown][]) => void>();
  // Two reasons writing is off. A read landing clears `unread`; nothing
  // clears `stopped`, which is the opener's choice.
  let unread = startUnread;
  let stopped = !(options.writable ?? true);
  const writable = (): boolean => !unread && !stopped;
  let closed = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryWait = retryMs === false ? 0 : retryMs;
  let reading: Promise<boolean> | null = null;
  let warned = false;
  let landed = (): void => {};
  const hasRead = new Promise<void>((resolve) => {
    if (startUnread) landed = resolve;
    else resolve();
  });

  const emit = (changes: RecordChange[]): void => {
    for (const listener of [...listeners]) listener(changes);
  };

  const queue = createWriteQueue({
    storage,
    prefix,
    debounceMs: options.debounceMs ?? 300,
    maxWaitMs: options.maxWaitMs ?? 1000,
    retryMs,
    retryMaxMs,
    writable,
    closed: () => closed,
    stopped: () => stopped,
  });

  const applyRemote = (changes: StorageChange[]): void => {
    const applied: RecordChange[] = [];
    const overruled: [string, unknown][] = [];
    for (const [key, value] of changes) {
      if (!key.startsWith(prefix)) continue;
      const name = key.slice(prefix.length);
      if (queue.owns(name)) {
        overruled.push([name, value]);
        continue;
      }
      if (value === undefined) {
        if (!values.has(name)) continue;
        values.delete(name);
      } else {
        values.set(name, value);
      }
      applied.push({ name, value, origin: 'remote' });
    }
    if (overruled.length > 0) for (const listener of [...overruledListeners]) listener(overruled);
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
    if (queue.size > 0) queue.schedule();
    landed();
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
    void queue.flush();
  };
  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') void queue.flush();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);
  }

  const remove = (name: string): void => {
    // An unread cache cannot tell what storage holds, so it queues the delete.
    if (!unread && !values.has(name) && !queue.has(name)) return;
    values.delete(name);
    queue.add(name, DELETED);
    emit([{ name, value: undefined, origin: 'local' }]);
    queue.schedule();
  };

  const cache: OwnedRecordCache = {
    prefix,
    get writable() {
      return writable();
    },
    has: (name) => values.has(name),
    get: (name) => values.get(name),
    entries: (namePrefix = '') => [...values].filter(([name]) => name.startsWith(namePrefix)),
    set: (name, value) => {
      if (value === undefined) return remove(name);
      values.set(name, value);
      queue.add(name, value);
      emit([{ name, value, origin: 'local' }]);
      queue.schedule();
    },
    delete: remove,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    flush: queue.flush,
    read,
    whenRead: () => hasRead,
    close: async () => {
      if (closed) return;
      stopRetrying();
      await queue.flush();
      closed = true;
      queue.stopRetrying();
      unsubscribe?.();
      if (typeof window !== 'undefined') {
        window.removeEventListener('pagehide', onPageHide);
        document.removeEventListener('visibilitychange', onVisibility);
      }
    },
    onOverruled: (listener) => {
      overruledListeners.add(listener);
      return () => {
        overruledListeners.delete(listener);
      };
    },
    seed: (entries) => {
      for (const [name, value] of entries) values.set(name, value);
    },
    stopWriting: () => {
      stopped = true;
      queue.discard();
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
