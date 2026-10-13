import type { CreateRecordCacheOptions, OwnedRecordCache, RecordCacheOptions, RecordChange } from './recordTypes';
import type { StorageChange, SyncStorageAdapter } from './types';

const DELETED = Symbol('deleted');

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
  const debounceMs = options.debounceMs ?? 300;
  const maxWaitMs = options.maxWaitMs ?? 1000;
  const retryMs = options.retryMs ?? 1000;
  const retryMaxMs = options.retryMaxMs ?? 30_000;
  const values = new Map<string, unknown>(options.initial ?? []);
  const queued = new Map<string, unknown>();
  // How many writes to each name are on their way to storage.
  const inFlight = new Map<string, number>();
  const listeners = new Set<(changes: RecordChange[]) => void>();
  const overruledListeners = new Set<(changes: [string, unknown][]) => void>();
  // Two reasons writing is off. A read landing clears `unread`; nothing
  // clears `stopped`, which is the opener's choice.
  let unread = startUnread;
  let stopped = !(options.writable ?? true);
  const writable = (): boolean => !unread && !stopped;
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let firstQueuedAt: number | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  const firstRetryWait = retryMs === false ? 0 : retryMs;
  let retryWait = firstRetryWait;
  let reading: Promise<boolean> | null = null;
  let warned = false;
  let writeRetryTimer: ReturnType<typeof setTimeout> | null = null;
  let writeRetryWait = retryWait;
  let writeWarned = false;
  let sending: Promise<boolean> | null = null;
  let landed = (): void => {};
  const hasRead = new Promise<void>((resolve) => {
    if (startUnread) landed = resolve;
    else resolve();
  });

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

  // One batch is on its way at a time. A rejected write is back in the queue
  // before the next batch is taken, so a newer write to its record stands.
  function flush(): Promise<boolean> {
    if (timer) clearTimeout(timer);
    timer = null;
    firstQueuedAt = null;
    // With nothing on its way the batch leaves in this tick, which a flush
    // on `pagehide` depends on.
    const mine = sending ? sending.then(send) : send();
    sending = mine;
    void mine.finally(() => {
      if (sending === mine) sending = null;
    });
    return mine;
  }

  async function send(): Promise<boolean> {
    if (queued.size === 0) return true;
    if (!writable()) return false;
    stopRetryingWrites();
    const batch = [...queued];
    queued.clear();
    for (const [name] of batch) inFlight.set(name, (inFlight.get(name) ?? 0) + 1);
    const landed = await Promise.all(
      batch.map(async ([name, value]) => {
        const key = prefix + name;
        try {
          if (value === DELETED) await storage.delete(key);
          else await storage.set(key, value);
          return true;
        } catch (error) {
          if (!writeWarned) {
            writeWarned = true;
            console.warn(`[storage] could not write "${key}"; trying again`, error);
          }
          // A write queued since is newer, and stands.
          if (!queued.has(name) && !stopped) queued.set(name, value);
          return false;
        } finally {
          const count = inFlight.get(name) ?? 1;
          if (count > 1) inFlight.set(name, count - 1);
          else inFlight.delete(name);
        }
      }),
    );
    if (landed.every(Boolean)) {
      writeWarned = false;
      writeRetryWait = firstRetryWait;
      return true;
    }
    retryWrites();
    return false;
  }

  function stopRetryingWrites(): void {
    if (writeRetryTimer) clearTimeout(writeRetryTimer);
    writeRetryTimer = null;
  }

  function retryWrites(): void {
    stopRetryingWrites();
    if (retryMs === false || closed || stopped || queued.size === 0) return;
    writeRetryTimer = setTimeout(() => {
      writeRetryTimer = null;
      void flush();
    }, writeRetryWait);
    writeRetryWait = Math.min(writeRetryWait * 2, retryMaxMs);
  }

  const applyRemote = (changes: StorageChange[]): void => {
    const applied: RecordChange[] = [];
    const overruled: [string, unknown][] = [];
    for (const [key, value] of changes) {
      if (!key.startsWith(prefix)) continue;
      const name = key.slice(prefix.length);
      if (queued.has(name) || inFlight.has(name)) {
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
    if (queued.size > 0) schedule();
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
    void flush();
  };
  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') void flush();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);
  }

  const remove = (name: string): void => {
    // An unread cache cannot tell what storage holds, so it queues the delete.
    if (!unread && !values.has(name) && !queued.has(name)) return;
    values.delete(name);
    queued.set(name, DELETED);
    emit([{ name, value: undefined, origin: 'local' }]);
    schedule();
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
      queued.set(name, value);
      emit([{ name, value, origin: 'local' }]);
      schedule();
    },
    delete: remove,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    flush,
    read,
    whenRead: () => hasRead,
    close: async () => {
      if (closed) return;
      stopRetrying();
      await flush();
      closed = true;
      stopRetryingWrites();
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
      queued.clear();
      if (timer) clearTimeout(timer);
      timer = null;
      stopRetrying();
      stopRetryingWrites();
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
