import { parse } from './json';
import type { StorageAdapter, StorageChange } from './types';
import { decodeUrlHash, encodeUrlHash } from './urlHash';

const URL_HASH_GUARD = typeof window !== 'undefined';

function readHashMap(): Record<string, string> {
  if (!URL_HASH_GUARD) return {};
  const raw = decodeUrlHash(window.location.hash.replace(/^#/, ''));
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

/** What each live subscription last saw, refreshed on this page's own writes
 *  so `hashchange` reports only somebody else's. */
const hashSubscribers = new Set<{ last: Record<string, string> }>();

function writeHashMap(map: Record<string, string>): void {
  if (!URL_HASH_GUARD) return;
  const encoded = encodeUrlHash(JSON.stringify(map));
  window.history.replaceState(null, '', `#${encoded}`);
  for (const sub of hashSubscribers) sub.last = { ...map };
}

/** Persist into the URL fragment, so the page's link carries its state and can
 *  be shared or bookmarked. Changes to the fragment made elsewhere — a pasted
 *  link, back and forward — arrive through `hashchange`. */
export const urlHashAdapter: StorageAdapter = {
  get: async (key) => {
    const raw = readHashMap()[key];
    return raw === undefined ? undefined : parse(raw);
  },
  list: async (prefix) =>
    Object.entries(readHashMap())
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, raw]): [string, unknown] => [key, parse(raw)]),
  set: async (key, value) => {
    const map = readHashMap();
    map[key] = JSON.stringify(value);
    writeHashMap(map);
  },
  delete: async (key) => {
    const map = readHashMap();
    delete map[key];
    writeHashMap(map);
  },
  subscribe: (prefix, on) => {
    if (!URL_HASH_GUARD) return () => {};
    const sub = { last: readHashMap() };
    hashSubscribers.add(sub);
    const handler = (): void => {
      const next = readHashMap();
      const changes: StorageChange[] = [];
      for (const key of new Set([...Object.keys(sub.last), ...Object.keys(next)])) {
        if (!key.startsWith(prefix) || sub.last[key] === next[key]) continue;
        const raw = next[key];
        changes.push([key, raw === undefined ? undefined : parse(raw)]);
      }
      sub.last = next;
      if (changes.length > 0) on(changes);
    };
    window.addEventListener('hashchange', handler);
    return () => {
      hashSubscribers.delete(sub);
      window.removeEventListener('hashchange', handler);
    };
  },
};
