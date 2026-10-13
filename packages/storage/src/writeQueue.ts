import type { StorageAdapter } from './types';

/** What the queue holds for a record to delete. */
export const DELETED = Symbol('deleted');

/** What a write queue reads from the cache it writes for. */
export interface WriteQueueOptions {
  storage: StorageAdapter;
  prefix: string;
  debounceMs: number;
  maxWaitMs: number;
  retryMs: number | false;
  retryMaxMs: number;
  /** Whether a batch may leave now. */
  writable(): boolean;
  closed(): boolean;
  stopped(): boolean;
}

/** A cache's writes on their way to storage: the newest per record, sent on a
 *  debounce, and sent again on a backoff when storage rejects one. */
export interface WriteQueue {
  /** How many records have a write waiting to leave. */
  readonly size: number;
  /** Whether a write to `name` is waiting to leave. */
  has(name: string): boolean;
  /** Whether a write to `name` is waiting or on its way. */
  owns(name: string): boolean;
  /** Queue `value` for `name`, replacing a write still waiting. */
  add(name: string, value: unknown): void;
  /** Send what is queued after the debounce. */
  schedule(): void;
  /** Send what is queued now. Resolves as `RecordCache.flush` does. */
  flush(): Promise<boolean>;
  /** Stop sending rejected writes again on a timer. */
  stopRetrying(): void;
  /** Drop every queued write and every timer. */
  discard(): void;
}

export function createWriteQueue(options: WriteQueueOptions): WriteQueue {
  const { storage, prefix, debounceMs, maxWaitMs, retryMs, retryMaxMs, writable, closed, stopped } = options;
  const queued = new Map<string, unknown>();
  // How many writes to each name are on their way to storage.
  const inFlight = new Map<string, number>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let firstQueuedAt: number | null = null;
  const firstRetryWait = retryMs === false ? 0 : retryMs;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryWait = firstRetryWait;
  let warned = false;
  let sending: Promise<boolean> | null = null;

  const schedule = (): void => {
    if (!writable() || closed()) return;
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

  async function write(name: string, value: unknown): Promise<boolean> {
    const key = prefix + name;
    try {
      if (value === DELETED) await storage.delete(key);
      else await storage.set(key, value);
      return true;
    } catch (error) {
      if (!warned) {
        warned = true;
        console.warn(`[storage] could not write "${key}"; trying again`, error);
      }
      // A write queued since is newer, and stands.
      if (!queued.has(name) && !stopped()) queued.set(name, value);
      return false;
    } finally {
      const count = inFlight.get(name) ?? 1;
      if (count > 1) inFlight.set(name, count - 1);
      else inFlight.delete(name);
    }
  }

  async function send(): Promise<boolean> {
    if (queued.size === 0) return true;
    if (!writable()) return false;
    stopRetrying();
    const batch = [...queued];
    queued.clear();
    for (const [name] of batch) inFlight.set(name, (inFlight.get(name) ?? 0) + 1);
    const landed = await Promise.all(batch.map(([name, value]) => write(name, value)));
    if (landed.every(Boolean)) {
      warned = false;
      retryWait = firstRetryWait;
      return true;
    }
    retry();
    return false;
  }

  function stopRetrying(): void {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
  }

  function retry(): void {
    stopRetrying();
    if (retryMs === false || closed() || stopped() || queued.size === 0) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void flush();
    }, retryWait);
    retryWait = Math.min(retryWait * 2, retryMaxMs);
  }

  return {
    get size() {
      return queued.size;
    },
    has: (name) => queued.has(name),
    owns: (name) => queued.has(name) || inFlight.has(name),
    add: (name, value) => {
      queued.set(name, value);
    },
    schedule,
    flush,
    stopRetrying,
    discard: () => {
      queued.clear();
      if (timer) clearTimeout(timer);
      timer = null;
      stopRetrying();
    },
  };
}
