import type { StorageAdapter } from './types';

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

/** Options for `createRecordCache` and `openRecords`. */
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
export type CreateRecordCacheOptions = RecordCacheOptions & {
  /** The records the cache starts out holding. */
  initial?: Iterable<[string, unknown]>;
  /** Whether the cache may write to storage. Default `true`. */
  writable?: boolean;
};
