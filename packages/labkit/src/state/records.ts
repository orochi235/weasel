import type { StorageAdapter, StorageChange } from './types';

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
  /** False once writing is off — the records could not be read, or were
   *  written by a newer labkit — so nothing here can overwrite them. */
  readonly writable: boolean;
  has(name: string): boolean;
  get(name: string): unknown;
  /** Every record whose name starts with `namePrefix`. */
  entries(namePrefix?: string): [string, unknown][];
  set(name: string, value: unknown): void;
  delete(name: string): void;
  subscribe(listener: (changes: RecordChange[]) => void): () => void;
  /** Send queued writes now. */
  flush(): Promise<void>;
  /** Send queued writes and stop hearing other writers. */
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
}

const DELETED = Symbol('deleted');

/** A cache holding `initial`, with nothing read from storage. */
export function createRecordCache(
  options: RecordCacheOptions & { initial?: Iterable<[string, unknown]>; writable?: boolean },
): OwnedRecordCache {
  const { storage, prefix } = options;
  const debounceMs = options.debounceMs ?? 300;
  const maxWaitMs = options.maxWaitMs ?? 1000;
  const values = new Map<string, unknown>(options.initial ?? []);
  const queued = new Map<string, unknown>();
  const listeners = new Set<(changes: RecordChange[]) => void>();
  let writable = options.writable ?? true;
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let firstQueuedAt: number | null = null;

  const emit = (changes: RecordChange[]): void => {
    for (const listener of [...listeners]) listener(changes);
  };

  const schedule = (): void => {
    if (!writable || closed) return;
    const now = Date.now();
    firstQueuedAt ??= now;
    if (timer) clearTimeout(timer);
    const wait = Math.max(0, Math.min(debounceMs, firstQueuedAt + maxWaitMs - now));
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, wait);
  };

  async function flush(): Promise<void> {
    if (timer) clearTimeout(timer);
    timer = null;
    firstQueuedAt = null;
    if (!writable || queued.size === 0) return;
    const batch = [...queued];
    queued.clear();
    await Promise.all(
      batch.map(async ([name, value]) => {
        const key = prefix + name;
        try {
          if (value === DELETED) await storage.delete(key);
          else await storage.set(key, value);
        } catch (error) {
          console.warn(`[labkit] could not write "${key}"; keeping it in memory`, error);
        }
      }),
    );
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

  const unsubscribe = writable ? storage.subscribe?.(prefix, applyRemote) : undefined;

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

  const cache: OwnedRecordCache & { applyRemote: typeof applyRemote } = {
    prefix,
    get writable() {
      return writable;
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
      if (!values.has(name) && !queued.has(name)) return;
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
    close: async () => {
      if (closed) return;
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
      writable = false;
      queued.clear();
      if (timer) clearTimeout(timer);
      timer = null;
      unsubscribe?.();
    },
    applyRemote,
  };
  return cache;
}

/** Read every record under `prefix` and hold them. A failed read opens the
 *  cache empty with writing off, so it never overwrites what it could not
 *  read. */
export async function openRecords(options: RecordCacheOptions): Promise<OwnedRecordCache> {
  // Listen before listing, so a change landing between the two is not lost.
  const early: StorageChange[] = [];
  const stopEarly = options.storage.subscribe?.(options.prefix, (c) => early.push(...c));
  let listed: [string, unknown][];
  try {
    listed = await options.storage.list(options.prefix);
  } catch (error) {
    stopEarly?.();
    console.warn(
      `[labkit] could not read "${options.prefix}"; opening empty and not persisting`,
      error,
    );
    return createRecordCache({ ...options, writable: false });
  }
  const cache = createRecordCache({
    ...options,
    initial: listed.map(([key, value]): [string, unknown] => [
      key.slice(options.prefix.length),
      value,
    ]),
  });
  stopEarly?.();
  (cache as unknown as { applyRemote: (c: StorageChange[]) => void }).applyRemote(early);
  return cache;
}
