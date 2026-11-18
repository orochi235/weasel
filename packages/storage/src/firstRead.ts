import { after } from '@weasel-js/registry';
import type { StorageAdapter, StorageChange } from './types';

/** A record cache's first read of storage, tried again on a backoff until it lands. */
export interface FirstRead {
  /** True until a read lands. */
  unread(): boolean;
  /** Try now, ahead of the backoff. Resolves whether the records have been read. */
  read(): Promise<boolean>;
  /** Report a read made elsewhere that threw, and schedule the next try. */
  failed(error: unknown): void;
  /** Resolves once a read lands; at once when the cache started read. */
  whenRead(): Promise<void>;
  stopRetrying(): void;
}

/** What a first read needs from the cache it reads for. */
export interface FirstReadOptions {
  storage: StorageAdapter;
  prefix: string;
  /** False when the cache opened holding its records. */
  startUnread: boolean;
  retryMs: number | false;
  retryMaxMs: number;
  /** False once the cache is closed or has stopped writing: no read is tried, and none lands. */
  live(): boolean;
  /** Start hearing other writers; called as a read lands, before its records are taken. */
  listen(): void;
  /** Take the records a read listed, and every change heard while listing them. */
  take(changes: StorageChange[]): void;
}

export function createFirstRead(opts: FirstReadOptions): FirstRead {
  const { storage, prefix, retryMs, retryMaxMs } = opts;
  let unread = opts.startUnread;
  let cancelRetry: (() => void) | null = null;
  let retryWait = retryMs === false ? 0 : retryMs;
  let reading: Promise<boolean> | null = null;
  let warned = false;
  let landed = (): void => {};
  const hasRead = new Promise<void>((resolve) => {
    if (opts.startUnread) landed = resolve;
    else resolve();
  });

  const stopRetrying = (): void => {
    cancelRetry?.();
    cancelRetry = null;
  };

  const failed = (error: unknown): void => {
    if (!warned) {
      warned = true;
      console.warn(
        `[storage] could not read "${prefix}"; opening empty and holding writes until a read lands`,
        error,
      );
    }
    if (retryMs === false || !opts.live()) return;
    cancelRetry = after(retryWait, () => {
      cancelRetry = null;
      void read();
    });
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
    if (!opts.live()) {
      stopEarly?.();
      return false;
    }
    unread = false;
    opts.listen();
    stopEarly?.();
    opts.take([...listed, ...early]);
    landed();
    return true;
  }

  function read(): Promise<boolean> {
    if (!unread || !opts.live()) return Promise.resolve(!unread);
    reading ??= attempt().finally(() => {
      reading = null;
    });
    return reading;
  }

  return {
    unread: () => unread,
    read,
    failed,
    whenRead: () => hasRead,
    stopRetrying,
  };
}
