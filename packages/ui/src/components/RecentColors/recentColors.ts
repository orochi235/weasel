import { toHex8 } from '@weasel-js/core';

/** The slice of the Web Storage API the store reads and writes. */
export interface RecentColorsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * The recently used colors, most recent first. The consumer owns one and
 * hands it to {@link RecentColorsProvider}; every picker inside records what
 * it applies, and {@link SwatchStrip} shows the list.
 */
export interface RecentColorsStore {
  /** The list, most recent first. The same array until the list changes. */
  get(): readonly string[];
  /** Move `colors` to the head, in the order given — a gradient's stops
   *  arrive as one call. Spellings of one color count once. */
  record(colors: string | readonly string[]): void;
  clear(): void;
  subscribe(listener: () => void): () => void;
}

/** Options for {@link createRecentColorsStore}. */
export interface RecentColorsStoreOptions {
  /** Most colors kept. Default 12. */
  limit?: number;
  /** Where the list persists. Default: `localStorage`, when the environment
   *  has one and lets it be read. `null` keeps the list in memory only. */
  storage?: RecentColorsStorage | null;
  /** Storage key. Default `weasel:recent-colors`. */
  key?: string;
}

const DEFAULT_LIMIT = 12;
const DEFAULT_KEY = 'weasel:recent-colors';

/** One spelling per color: hex expands to lowercase `#rrggbbaa`; any other
 *  CSS color is kept as written. */
export function normalizeRecentColor(color: string): string | null {
  const trimmed = color.trim();
  if (trimmed === '') return null;
  return trimmed.startsWith('#') ? toHex8(trimmed).toLowerCase() : trimmed;
}

function defaultStorage(): RecentColorsStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function merge(head: readonly string[], rest: readonly string[], limit: number): string[] {
  const out: string[] = [];
  for (const raw of [...head, ...rest]) {
    const c = normalizeRecentColor(raw);
    if (c !== null && !out.includes(c)) out.push(c);
    if (out.length >= limit) break;
  }
  return out;
}

function read(storage: RecentColorsStorage | null, key: string, limit: number): string[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(key);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return merge(parsed.filter((c): c is string => typeof c === 'string'), [], limit);
  } catch {
    return [];
  }
}

function same(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((c, i) => c === b[i]);
}

/**
 * A {@link RecentColorsStore}, persisted to `localStorage` by default. Every
 * storage access is guarded: a browser that blocks storage, throws on the
 * accessor or is out of quota gets a store that works for the session.
 */
export function createRecentColorsStore(options: RecentColorsStoreOptions = {}): RecentColorsStore {
  const limit = Math.max(1, options.limit ?? DEFAULT_LIMIT);
  const key = options.key ?? DEFAULT_KEY;
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const listeners = new Set<() => void>();
  let list: readonly string[] = read(storage, key, limit);

  const set = (next: readonly string[], persist: boolean): void => {
    if (same(next, list)) return;
    list = next;
    if (persist && storage) {
      try {
        storage.setItem(key, JSON.stringify(list));
      } catch { /* the in-memory list stands */ }
    }
    for (const l of [...listeners]) l();
  };

  // Another tab writing the same key. Only a real `localStorage` fires these.
  const onStorage = (e: StorageEvent): void => {
    if (e.key === key) set(read(storage, key, limit), false);
  };
  const watchesOtherTabs = options.storage === undefined && storage !== null && typeof window !== 'undefined';

  return {
    get: () => list,
    record: (colors) => set(merge(typeof colors === 'string' ? [colors] : colors, list, limit), true),
    clear: () => set([], true),
    subscribe: (listener) => {
      if (listeners.size === 0 && watchesOtherTabs) window.addEventListener('storage', onStorage);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && watchesOtherTabs) window.removeEventListener('storage', onStorage);
      };
    },
  };
}
