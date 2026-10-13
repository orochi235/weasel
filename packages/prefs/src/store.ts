import { createEmitter } from '@weasel-js/registry';
import type { OwnedRecordCache } from '@weasel-js/storage';
import { checkPrefConditions } from './conditionCheck';
import { recordValue, stampRecord } from './stamp';
import { assignPrefValueAtPath, prefHoldsValue, prefLeaves, prefSectionLeaves, setOwnPrefValue, VERSION_RECORD } from './helpers';
import type { PrefList } from './list';
import type { PrefMap } from './map';
import type { PrefPath, PrefValueAt } from './paths';
import { type PrefValidator, repairPrefValue } from './repair';
import type { PrefGroup } from './groups';
import type { PrefLeaf, PrefObject } from './schema';
import { prefVariantOf, type PrefUnion } from './union';

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
  /** Every stored record as a nested tree, unrepaired, including records no
   *  leaf describes. The same object until something changes. */
  stored(): Record<string, unknown>;
  /** `changes` is empty when only records no leaf describes changed. */
  subscribe(listener: (changes: PrefChange[]) => void): () => void;
  /** False while the store cannot persist: storage has not been read yet, or
   *  was written by a newer schema. Changes still apply for this session, and
   *  ones made before a late read lands are persisted when it does. */
  readonly writable: boolean;
  /** Try again now to read storage that could not be read at open, ahead of
   *  the store's own retries. Resolves whether storage has been read. */
  read(): Promise<boolean>;
  /** Resolves once storage has been read: at once for a store that opened
   *  with its values, and when a later read lands for one that could not. */
  whenRead(): Promise<void>;
  /** Resolves true when every queued write reached storage. */
  flush(): Promise<boolean>;
  close(): Promise<void>;
}

interface Snapshot {
  byPath: Map<string, unknown>;
  tree: Record<string, unknown>;
  unset: ReadonlySet<string>;
}

/** JSON storage cannot keep an infinity; `repairPrefValue` reads these back. */
const encodeInfinity = (leaf: PrefLeaf, value: unknown): unknown => {
  if (leaf.kind === 'number') return value === Infinity || value === -Infinity ? String(value) : value;
  if (leaf.kind === 'list' && Array.isArray(value)) {
    const { item } = leaf as PrefList;
    return value.map((entry) => encodeInfinity(item, entry));
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
  const held = value as Record<string, unknown>;
  if (leaf.kind === 'map') {
    const { item } = leaf as PrefMap;
    return Object.fromEntries(Object.entries(held).map(([key, entry]) => [key, encodeInfinity(item, entry)]));
  }
  const fields = leaf.kind === 'union' ? prefVariantOf(leaf as PrefUnion, held)?.[1] : leaf;
  if (fields?.kind !== 'object') return value;
  let out: Record<string, unknown> | undefined;
  for (const [key, field] of prefSectionLeaves((fields as PrefObject).children)) {
    if (!Object.hasOwn(held, key)) continue;
    const encoded = encodeInfinity(field, held[key]);
    if (encoded !== held[key]) (out ??= { ...held })[key] = encoded;
  }
  return out ?? value;
};

/** A store over an open cache. `openPrefs` / `openPrefsSync` are the usual
 *  way in; they run migrations first. */
export function createPrefsStore<S extends PrefGroup>(
  schema: S,
  cache: OwnedRecordCache,
  validators?: Readonly<Record<string, PrefValidator>>,
  onClose?: () => void,
  /** The schema version a value set here is in, stamped on its record. */
  version = 0,
): PrefsStore<S> {
  const leaves = new Map([...prefLeaves(schema)].filter(([, leaf]) => prefHoldsValue(leaf)));
  for (const { field, at, problem } of checkPrefConditions(schema)) {
    console.warn(`[prefs] ${field} of ${at === '' ? 'the schema' : `"${at}"`}: ${problem}`);
  }
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
        const record = cache.get(path);
        const stored = recordValue(record);
        raw.set(path, record);
        value =
          previous?.raw.has(path) && previous.raw.get(path) === record
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

  let storedTree: Record<string, unknown> | null = null;
  const buildStored = (): Record<string, unknown> => {
    const tree: Record<string, unknown> = {};
    const branches = new WeakSet<object>([tree]);
    for (const [name, record] of cache.entries()) {
      if (name === VERSION_RECORD) continue;
      const value = recordValue(record);
      const parts = name.split('.');
      let cursor = tree;
      for (const part of parts.slice(0, -1)) {
        const next = cursor[part];
        // A record's own value is never descended into: one named `a` and
        // another `a.b` cannot both show, and the branch wins.
        if (typeof next === 'object' && next !== null && branches.has(next)) {
          cursor = next as Record<string, unknown>;
        } else {
          const branch: Record<string, unknown> = {};
          branches.add(branch);
          setOwnPrefValue(cursor, part, branch);
          cursor = branch;
        }
      }
      const last = parts[parts.length - 1]!;
      if (!branches.has(cursor[last] as object)) setOwnPrefValue(cursor, last, value);
    }
    return tree;
  };

  let changed = createEmitter<[PrefChange[]]>();
  const stopCache = cache.subscribe((changes) => {
    const records = changes.filter((c) => c.name !== VERSION_RECORD);
    if (records.length === 0) return;
    storedTree = null;
    const mine = records.filter((c) => leaves.has(c.name));
    if (mine.length > 0) snapshot = null;
    const now = current();
    const out = mine.map((c): PrefChange => ({ path: c.name, value: now.byPath.get(c.name), origin: c.origin }));
    changed.emit(out);
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
      const stored = encodeInfinity(leaf, value);
      // Unset is stored as nothing, which a stamp would turn into something.
      cache.set(path, stored === undefined ? undefined : stampRecord(stored, version));
    },
    reset: (path) => {
      for (const p of leaves.keys()) {
        if (path === undefined || p === path || p.startsWith(`${path}.`)) cache.delete(p);
      }
    },
    isSet: (path) => cache.has(path),
    values: () => current().tree,
    unset: () => current().unset,
    stored: () => (storedTree ??= buildStored()),
    subscribe: (listener) => changed.subscribe(listener),
    get writable() {
      return cache.writable;
    },
    read: () => cache.read(),
    whenRead: () => cache.whenRead(),
    flush: () => cache.flush(),
    close: async () => {
      onClose?.();
      stopCache();
      changed = createEmitter();
      await cache.close();
    },
  };
}
