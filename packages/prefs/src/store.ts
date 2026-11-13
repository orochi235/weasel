import { createEmitter } from '@weasel-js/registry';
import type { OwnedRecordCache } from '@weasel-js/storage';
import type { PrefBlend } from './blend';
import { checkPrefConditions } from './conditionCheck';
import { autoRecord, recordValue } from './stamp';
import { prefCanAuto, prefStartsAuto } from './autoReset';
import { assignPrefValueAtPath, prefHoldsValue, prefLeaves, setOwnPrefValue, VERSION_RECORD } from './helpers';
import { isPrefScope, selectionWeights, type PrefScope, type PrefSelection, type PrefWeights } from './scope';
import { createSnapshots, resolveHeld, selectionAt, weightsUnder, type SnapshotSource } from './snapshot';
import { checkPrefSplits, prefSelectors, admittedSelectors } from './splitCheck';
import type { PrefPath, PrefValueAt } from './paths';
import type { PrefValidator } from './repair';
import type { PrefGroup } from './groups';
import { prefWrites } from './storeWrites';

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
  /**
   * The leaf's value, repaired against the schema; its default when unset, and while it is auto its
   * `auto.value` (`undefined` where it declares none). A
   * split value is folded: under the selectors' own values it is the member
   * they name, and under `weights` it is the blend its kind makes of the
   * members that weigh something. A selector `weights` leaves out keeps its
   * own value, or with `at` the option given there. An admitted selector, a path a
   * `scopes` entry names that is no leaf, has an option only where `at` or
   * `weights` gives it one, and reads its shared member elsewhere.
   */
  get<P extends PrefPath<S>>(path: P, read?: { weights?: PrefWeights; at?: PrefSelection }): PrefValueAt<S, P>;
  /** On a scoped pref, writes the value the selectors' own values name, or
   *  with `at` the one named with each selector there set to the option given,
   *  making what is stored the shape its `scopes` declare on the way. A
   *  {@link PrefScope} given as the value replaces the whole of what is held. */
  set<P extends PrefPath<S>>(path: P, value: PrefValueAt<S, P> | PrefScope, write?: { at?: PrefSelection }): void;
  /** What the leaf holds where its value is split, each member repaired. */
  scope(path: PrefPath<S>): PrefScope | undefined;
  /** What every split leaf holds, by its path. The same map until something changes. */
  scopes(): ReadonlyMap<string, PrefScope>;
  /** Put every leaf at or under `path` back as its schema says (`prefResetOf`), storing nothing for it: auto
   *  where it says `auto.on`, else at its default. With no path, all. */
  reset(path?: string): void;
  /** Whether anything is stored for the leaf: a value it is pinned at, or a mark that it is auto where its
   *  schema starts it pinned. A mark for a leaf that does not opt into auto is read as nothing stored. */
  isSet(path: PrefPath<S>): boolean;
  /** The leaves now auto: unpinned, each reading its `auto.value` (`prefAutoValue`; a store computes nothing
   *  else), never its default. The same set until something changes. */
  auto(): ReadonlySet<string>;
  /** Whether the leaf is auto now. */
  isAuto(path: PrefPath<S>): boolean;
  /** Unpin the leaf, given true; given false, pin it at the value it reads now. A leaf whose schema does not
   *  declare `auto` is always pinned, and turning it auto warns and does nothing. */
  setAuto(path: PrefPath<S>, next: boolean): void;
  /** Every leaf's value as a nested tree. The same object until something
   *  changes. With `at`, the tree as it would read with each selector named
   *  there set to the option given, built for the call. */
  values(read?: { at?: PrefSelection }): Record<string, unknown>;
  /** The leaves nothing is stored for, each as its schema starts it. The same set until something changes. */
  unset(): ReadonlySet<string>;
  /** Every stored record as a nested tree, unrepaired, including records no
   *  leaf describes. The same object until something changes. */
  stored(): Record<string, unknown>;
  /** `changes` is empty when only records no leaf describes changed. A
   *  selector changing is a change to every leaf split by it. */
  subscribe(listener: (changes: PrefChange[]) => void): () => void;
  /** False while the store cannot persist: storage has not been read yet, or
   *  was written by a newer schema. Changes still apply for this session, and
   *  ones made before a late read lands are persisted when it does. False for
   *  good once the store is closed. */
  readonly writable: boolean;
  /** True once `close` was called. A write after that changes what this store
   *  reads and reaches neither storage nor its subscribers, and the first one
   *  warns. */
  readonly closed: boolean;
  /** Try again now to read storage that could not be read at open, ahead of
   *  the store's own retries. Resolves whether storage has been read. */
  read(): Promise<boolean>;
  /** Resolves once storage has been read: at once for a store that opened
   *  with its values, and when a later read lands for one that could not. */
  whenRead(): Promise<void>;
  /** Resolves true when every queued write reached storage. */
  flush(): Promise<boolean>;
  /** Resolves as `flush` does, with the writes it sends before closing. */
  close(): Promise<boolean>;
}

/** Every record of `cache` but the version's, as a nested tree of unrepaired values. */
function storedRecords(cache: OwnedRecordCache): Record<string, unknown> {
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
}

/** A store over an open cache. `openPrefs` / `openPrefsSync` are the usual
 *  way in; they run migrations first. */
export function createPrefsStore<S extends PrefGroup>(
  schema: S,
  cache: OwnedRecordCache,
  validators?: Readonly<Record<string, PrefValidator>>,
  onClose?: () => void,
  /** The schema version a value set here is in, stamped on its record. */
  version = 0,
  blends?: Readonly<Record<string, PrefBlend>>,
): PrefsStore<S> {
  const leaves = new Map([...prefLeaves(schema)].filter(([, leaf]) => prefHoldsValue(leaf)));
  for (const { field, at, problem } of checkPrefConditions(schema)) {
    console.warn(`[prefs] ${field} of ${at === '' ? 'the schema' : `"${at}"`}: ${problem}`);
  }
  for (const { at, problem } of checkPrefSplits(schema)) console.warn(`[prefs] ${at === '' ? 'the schema' : `scopes of "${at}"`}: ${problem}`);
  const source: SnapshotSource = { leaves, cache, selectors: prefSelectors(leaves), admitted: admittedSelectors(schema), validators, blends };
  const { current, peek, drop } = createSnapshots(source);

  let storedTree: Record<string, unknown> | null = null;

  let changed = createEmitter<[PrefChange[]]>();
  const stopCache = cache.subscribe((changes) => {
    const records = changes.filter((c) => c.name !== VERSION_RECORD);
    if (records.length === 0) return;
    storedTree = null;
    const mine = records.filter((c) => leaves.has(c.name));
    const before = peek();
    if (mine.length > 0) drop();
    const now = current();
    const origins = new Map(mine.map((c) => [c.name, c.origin]));
    for (const c of mine) {
      for (const path of [...(before?.splitUnder.get(c.name) ?? []), ...(now.splitUnder.get(c.name) ?? [])]) {
        if (!origins.has(path)) origins.set(path, c.origin);
      }
    }
    changed.emit([...origins].map(([path, origin]): PrefChange => ({ path, value: now.byPath.get(path), origin })));
  });

  let closed = false;
  let warned = false;
  const warnIfClosed = (path: string | undefined): void => {
    if (!closed || warned) return;
    warned = true;
    console.warn(`[prefs] write to a closed store${path === undefined ? '' : ` at "${path}"`}; it will not persist`);
  };
  const writes = prefWrites({ leaves, cache, selectors: source.selectors, admitted: source.admitted!, version, selection: () => current().selection, warnIfClosed });
  return {
    schema,
    ...writes,
    auto: () => current().auto,
    isAuto: (path) => current().auto.has(path),
    setAuto: (path, next) => {
      warnIfClosed(path);
      const leaf = leaves.get(path);
      if (!leaf || !prefCanAuto(leaf)) {
        console.warn(`[prefs] "${path}" cannot be auto; ignoring the write`);
        return;
      }
      const now = current();
      if (now.auto.has(path) === next) return;
      // Pinning a leaf that reads nothing while auto pins what its control shows: its default.
      if (!next) writes.set(path, now.held.get(path) ?? leaf.default);
      else if (prefStartsAuto(leaf)) cache.delete(path);
      else cache.set(path, autoRecord(version));
    },
    get: (path, read) => {
      const now = current();
      if (!read?.weights && !read?.at) return now.byPath.get(path) as never;
      const leaf = leaves.get(path);
      const selection = read.at ? selectionAt(source.selectors, now.selection, read.at, source.admitted) : now.selection;
      if (read.at && source.selectors.has(path)) return selection[path] as never;
      const weights = weightsUnder(source.selectors, selection, read.weights ?? {}, source.admitted);
      return (leaf ? resolveHeld(source, leaf, now.held.get(path), weights) : undefined) as never;
    },
    scope: (path) => {
      const held = current().held.get(path);
      return isPrefScope(held) ? held : undefined;
    },
    scopes: () => current().scopes,
    reset: (path) => {
      warnIfClosed(path);
      for (const p of leaves.keys()) {
        if (path === undefined || p === path || p.startsWith(`${path}.`)) cache.delete(p);
      }
    },
    isSet: (path) => (leaves.has(path) ? !current().unset.has(path) : cache.has(path)),
    values: (read) => {
      const now = current();
      if (!read?.at) return now.tree;
      const selection = selectionAt(source.selectors, now.selection, read.at, source.admitted);
      const weights = selectionWeights(selection);
      const tree: Record<string, unknown> = {};
      for (const [path, leaf] of leaves) {
        const set = source.selectors.has(path) ? selection[path] : resolveHeld(source, leaf, now.held.get(path), weights);
        assignPrefValueAtPath(tree, path, set);
      }
      return tree;
    },
    unset: () => current().unset,
    stored: () => (storedTree ??= storedRecords(cache)),
    subscribe: (listener) => changed.subscribe(listener),
    get writable() {
      return !closed && cache.writable;
    },
    get closed() {
      return closed;
    },
    read: () => cache.read(),
    whenRead: () => cache.whenRead(),
    flush: () => cache.flush(),
    close: async () => {
      closed = true;
      onClose?.();
      stopCache();
      changed = createEmitter();
      return cache.close();
    },
  };
}
