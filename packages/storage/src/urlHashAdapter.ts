import { jsonLossWarner, parse, toJson } from './json';
import type { StorageAdapter, StorageChange } from './types';
import { decodeUrlHash, encodeUrlHash } from './urlHash';

const URL_HASH_GUARD = typeof window !== 'undefined';

/** The fragment's records, each still the JSON text it is stored as. Anyone
 *  can write a fragment, so whatever is not a map of strings reads as absent. */
function readHashMap(): Map<string, string> {
  const map = new Map<string, string>();
  if (!URL_HASH_GUARD) return map;
  const raw = decodeUrlHash(window.location.hash.replace(/^#/, ''));
  if (!raw) return map;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return map;
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return map;
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === 'string') map.set(key, value);
  }
  return map;
}

/** What each live subscription last saw, refreshed on this page's own writes
 *  so `hashchange` reports only somebody else's. */
const hashSubscribers = new Set<{ last: Map<string, string> }>();

function writeHashMap(map: Map<string, string>): void {
  if (!URL_HASH_GUARD) return;
  const encoded = encodeUrlHash(JSON.stringify(Object.fromEntries(map)));
  window.history.replaceState(window.history.state, '', `#${encoded}`);
  for (const sub of hashSubscribers) sub.last = new Map(map);
}

const warnLoss = jsonLossWarner('the URL fragment');

/** Persist into the URL fragment, so the page's link carries its state and can
 *  be shared or bookmarked. Changes to the fragment made elsewhere — a pasted
 *  link, back and forward — arrive through `hashchange`. */
export const urlHashAdapter: StorageAdapter = {
  get: async (key) => {
    const raw = readHashMap().get(key);
    return raw === undefined ? undefined : parse(raw);
  },
  list: async (prefix) =>
    [...readHashMap()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, raw]): [string, unknown] => [key, parse(raw)]),
  set: async (key, value) => {
    if (value === undefined) return urlHashAdapter.delete(key);
    warnLoss(key, value);
    const map = readHashMap();
    map.set(key, toJson(value));
    writeHashMap(map);
  },
  delete: async (key) => {
    const map = readHashMap();
    // Nothing to remove: a fragment someone else wrote, an anchor say, stays as it is.
    if (!map.delete(key)) return;
    writeHashMap(map);
  },
  subscribe: (prefix, on) => {
    if (!URL_HASH_GUARD) return () => {};
    const sub = { last: readHashMap() };
    hashSubscribers.add(sub);
    const handler = (): void => {
      const next = readHashMap();
      const changes: StorageChange[] = [];
      for (const key of new Set([...sub.last.keys(), ...next.keys()])) {
        if (!key.startsWith(prefix) || sub.last.get(key) === next.get(key)) continue;
        const raw = next.get(key);
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
