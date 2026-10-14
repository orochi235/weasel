import { createEmitter } from '@weasel-js/registry';
import type { OwnedRecordCache } from '@weasel-js/storage';
import type { PrefBlend } from './blend';
import { checkPrefConditions } from './conditionCheck';
import { recordValue } from './stamp';
import { assignPrefValueAtPath, prefHoldsValue, prefLeaves, setOwnPrefValue, VERSION_RECORD } from './helpers';
import { isPrefLocus, selectionWeights, type PrefLocus, type PrefSelection, type PrefWeights } from './locus';
import { createSnapshots, resolveHeld, selectionAt, weightsUnder, type SnapshotSource } from './snapshot';
import { checkPrefSplits, prefSelectors } from './splitCheck';
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
   * The leaf's value, repaired against the schema; its default when unset. A
   * split value is folded: under the selectors' own values it is the member
   * they name, and under `weights` it is the blend its kind makes of the
   * members that weigh something. A selector `weights` leaves out keeps its
   * own value.
   */
  get<P extends PrefPath<S>>(path: P, read?: { weights?: PrefWeights }): PrefValueAt<S, P>;
  /** On a split leaf, writes the member the selectors' own values name. A
   *  {@link PrefLocus} given as the value replaces the whole of what is held. */
  set<P extends PrefPath<S>>(path: P, value: PrefValueAt<S, P> | PrefLocus): void;
  /** Hold the leaf's value once per option of the selector at `by`, one of
   *  the leaf's `splitBy`, each option starting as the value it had. */
  split(path: PrefPath<S>, by: string): void;
  /** Stop splitting the leaf's value by the selector at `by`, keeping the
   *  member that selector's own value names. */
  join(path: PrefPath<S>, by: string): void;
  /** What the leaf holds where its value is split, each member repaired. */
  locus(path: PrefPath<S>): PrefLocus | undefined;
  /** Unset every leaf at or under `path`; with no path, all. */
  reset(path?: string): void;
  /** Whether the leaf has a value of its own rather than following its default. */
  isSet(path: PrefPath<S>): boolean;
  /** Every leaf's value as a nested tree. The same object until something
   *  changes. With `at`, the tree as it would read with each selector named
   *  there set to the option given, built for the call. */
  values(read?: { at?: PrefSelection }): Record<string, unknown>;
  /** The leaves following their default. The same set until something changes. */
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
  close(): Promise<void>;
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
  for (const { at, problem } of checkPrefSplits(schema)) console.warn(`[prefs] splitBy of "${at}": ${problem}`);
  const source: SnapshotSource = { leaves, cache, selectors: prefSelectors(leaves), validators, blends };
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
      for (const path of [...(before?.splitBy.get(c.name) ?? []), ...(now.splitBy.get(c.name) ?? [])]) {
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
  return {
    schema,
    ...prefWrites({ leaves, cache, selectors: source.selectors, version, selection: () => current().selection, warnIfClosed }),
    get: (path, read) => {
      const now = current();
      if (!read?.weights) return now.byPath.get(path) as never;
      const leaf = leaves.get(path);
      const weights = weightsUnder(source.selectors, now.selection, read.weights);
      return (leaf ? resolveHeld(source, leaf, now.held.get(path), weights) : undefined) as never;
    },
    locus: (path) => {
      const held = current().held.get(path);
      return isPrefLocus(held) ? held : undefined;
    },
    reset: (path) => {
      warnIfClosed(path);
      for (const p of leaves.keys()) {
        if (path === undefined || p === path || p.startsWith(`${path}.`)) cache.delete(p);
      }
    },
    isSet: (path) => cache.has(path),
    values: (read) => {
      const now = current();
      if (!read?.at) return now.tree;
      const selection = selectionAt(source.selectors, now.selection, read.at);
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
      await cache.close();
    },
  };
}
