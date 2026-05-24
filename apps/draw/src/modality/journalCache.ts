import type { Journal } from '@orochi235/weasel-history';

export interface CreateJournalCacheOptions {
  /** Maximum entries before LRU eviction. Spec says 8 for WeaselDraw. */
  capacity: number;
}

export interface JournalCache {
  get(modeId: string, targetId: string): Journal | null;
  put(modeId: string, targetId: string, journal: Journal): void;
  remove(modeId: string, targetId: string): void;
  clear(): void;
}

export function createJournalCache(opts: CreateJournalCacheOptions): JournalCache {
  const cap = opts.capacity;
  // Insertion order in a Map is iteration order — reorder by delete+set.
  const store = new Map<string, Journal>();
  const key = (m: string, t: string) => `${m}\x00${t}`;

  return {
    get(modeId, targetId) {
      const k = key(modeId, targetId);
      const j = store.get(k);
      if (!j) return null;
      // Bump to MRU
      store.delete(k);
      store.set(k, j);
      return j;
    },
    put(modeId, targetId, journal) {
      const k = key(modeId, targetId);
      if (store.has(k)) store.delete(k);
      store.set(k, journal);
      while (store.size > cap) {
        const oldest = store.keys().next().value as string | undefined;
        if (oldest === undefined) break;
        store.delete(oldest);
      }
    },
    remove(modeId, targetId) {
      store.delete(key(modeId, targetId));
    },
    clear() {
      store.clear();
    },
  };
}
