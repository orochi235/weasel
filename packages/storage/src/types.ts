/** A change someone else made to one record: its new value, or `undefined`
 *  when it was deleted. */
export type StorageChange = [key: string, value: unknown];

/** Asynchronous keyed storage of structured-clone values, so IndexedDB, the
 *  URL, memory or a server can all back one. */
export interface StorageAdapter {
  /** `undefined` when the key is absent. */
  get(key: string): Promise<unknown>;
  list(prefix: string): Promise<[string, unknown][]>;
  /** Every record under `prefix`, read without waiting. Only substrates that
   *  can answer synchronously implement it. */
  listSync?(prefix: string): [string, unknown][];
  /** Rejects when the value did not land. */
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  /** Reports writes under `prefix` made by anyone but this adapter — another
   *  tab, another instance, a server. Omit when the substrate cannot tell. */
  subscribe?(prefix: string, on: (changes: StorageChange[]) => void): () => void;
}

/** An adapter `openRecordsSync` can open. */
export type SyncStorageAdapter = StorageAdapter & Required<Pick<StorageAdapter, 'listSync'>>;
