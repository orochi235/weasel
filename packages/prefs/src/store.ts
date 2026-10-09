import type { OwnedRecordCache } from '@weasel-js/storage';
import { assignPrefValueAtPath, prefLeaves } from './helpers';
import type { PrefPath, PrefValueAt } from './paths';
import { type PrefValidator, repairPrefValue } from './repair';
import type { PrefGroup, PrefLeaf } from './schema';

/** One leaf changing, as a store subscriber hears it: the value readers now
 *  see, and whether this store or another writer made the change. */
export interface PrefChange {
  path: string;
  value: unknown;
  origin: 'local' | 'remote';
}

/** Values for one schema, held in memory and persisted behind. */
export interface PrefsStore<S extends PrefGroup> {
  readonly schema: S;
  /** The leaf's value, repaired against the schema; its default when unset. */
  get<P extends PrefPath<S>>(path: P): PrefValueAt<S, P>;
  set<P extends PrefPath<S>>(path: P, value: PrefValueAt<S, P>): void;
  /** Unset every leaf at or under `path`; with no path, all. */
  reset(path?: string): void;
  /** Whether the leaf has a value of its own rather than following its default. */
  isSet(path: PrefPath<S>): boolean;
  /** Every leaf's value as a nested tree. The same object until something changes. */
  values(): Record<string, unknown>;
  /** The leaves following their default. The same set until something changes. */
  unset(): ReadonlySet<string>;
  subscribe(listener: (changes: PrefChange[]) => void): () => void;
  /** False when the store cannot persist: storage was unreadable, or written
   *  by a newer schema. Changes still apply for this session. */
  readonly writable: boolean;
  flush(): Promise<void>;
  close(): Promise<void>;
}

/** The record holding the schema version the stored values were written at. */
export const VERSION_RECORD = '$version';

interface Snapshot {
  byPath: Map<string, unknown>;
  tree: Record<string, unknown>;
  unset: ReadonlySet<string>;
}

/** JSON storage cannot keep an infinity; `repairPrefValue` reads these back. */
const encodeInfinity = (leaf: PrefLeaf, value: unknown): unknown =>
  leaf.kind === 'number' && (value === Infinity || value === -Infinity) ? String(value) : value;

/** A store over an open cache. `openPrefs` / `openPrefsSync` are the usual
 *  way in; they run migrations first. */
export function createPrefsStore<S extends PrefGroup>(
  schema: S,
  cache: OwnedRecordCache,
  validators?: Readonly<Record<string, PrefValidator>>,
  onClose?: () => void,
): PrefsStore<S> {
  const leaves = prefLeaves(schema);
  let snapshot: Snapshot | null = null;
  let previous: { raw: Map<string, unknown>; byPath: Map<string, unknown> } | null = null;

  const build = (): Snapshot => {
    const byPath = new Map<string, unknown>();
    const raw = new Map<string, unknown>();
    const unset = new Set<string>();
    const tree: Record<string, unknown> = {};
    for (const [path, leaf] of leaves) {
      const has = cache.has(path);
      let value: unknown;
      if (!has) {
        value = leaf.default;
        unset.add(path);
      } else {
        const stored = cache.get(path);
        raw.set(path, stored);
        value =
          previous?.raw.has(path) && previous.raw.get(path) === stored
            ? previous.byPath.get(path)
            : repairPrefValue(leaf, stored, validators);
      }
      byPath.set(path, value);
      assignPrefValueAtPath(tree, path, value);
    }
    previous = { raw, byPath };
    return { byPath, tree, unset };
  };
  const current = (): Snapshot => (snapshot ??= build());

  const listeners = new Set<(changes: PrefChange[]) => void>();
  const stopCache = cache.subscribe((changes) => {
    const mine = changes.filter((c) => leaves.has(c.name));
    if (mine.length === 0) return;
    snapshot = null;
    const now = current();
    const out = mine.map((c): PrefChange => ({ path: c.name, value: now.byPath.get(c.name), origin: c.origin }));
    for (const listener of [...listeners]) listener(out);
  });

  return {
    schema,
    get: (path) => current().byPath.get(path) as never,
    set: (path, value) => {
      const leaf = leaves.get(path);
      if (!leaf) {
        console.warn(`[prefs] no leaf at "${path}"; ignoring the write`);
        return;
      }
      cache.set(path, encodeInfinity(leaf, value));
    },
    reset: (path) => {
      for (const p of leaves.keys()) {
        if (path === undefined || p === path || p.startsWith(`${path}.`)) cache.delete(p);
      }
    },
    isSet: (path) => cache.has(path),
    values: () => current().tree,
    unset: () => current().unset,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    get writable() {
      return cache.writable;
    },
    flush: () => cache.flush(),
    close: async () => {
      onClose?.();
      stopCache();
      listeners.clear();
      await cache.close();
    },
  };
}
