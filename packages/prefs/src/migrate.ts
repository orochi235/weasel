import type { OwnedRecordCache } from '@weasel-js/storage';
import { VERSION_RECORD } from './helpers';

const isVersion = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

/** Takes stored records from one version to the next: rename, transform or
 *  delete entries in `records`, keyed by leaf path. */
export type PrefsMigration = (records: Map<string, unknown>) => void;

/**
 * Bring `cache` up to `migrations.length`, the current version. Every record
 * a migration leaves is written back, so a migration may replace values or
 * mutate them in place. Stops writing, and writes nothing, when the stored
 * version is newer than this build knows or a migration throws. Returns
 * whether it wrote. With `only`, the migrations see and change just those
 * records, the rest being this build's shape already.
 */
export function runPrefsMigrations(
  cache: OwnedRecordCache,
  migrations: readonly PrefsMigration[],
  only?: ReadonlySet<string>,
): boolean {
  const target = migrations.length;
  const raw = cache.get(VERSION_RECORD);
  if (cache.has(VERSION_RECORD) && !isVersion(raw)) {
    console.warn(
      `[prefs] "${cache.prefix}" has an unreadable ${VERSION_RECORD} (${JSON.stringify(raw)}); opening read-only`,
    );
    cache.stopWriting();
    return false;
  }
  const stored = cache.has(VERSION_RECORD) ? (raw as number) : 0;
  if (stored > target) {
    console.warn(
      `[prefs] "${cache.prefix}" was written at version ${stored}, newer than this build's ${target}; opening read-only`,
    );
    cache.stopWriting();
    return false;
  }
  if (stored === target || !cache.writable) return false;

  const before = cache
    .entries()
    .filter(([name]) => name !== VERSION_RECORD && (only?.has(name) ?? true));
  const records = new Map(before.map(([name, value]): [string, unknown] => [name, structuredClone(value)]));
  for (let v = stored; v < target; v++) {
    try {
      migrations[v]!(records);
    } catch (error) {
      console.warn(
        `[prefs] migration ${v} → ${v + 1} for "${cache.prefix}" threw; opening read-only on the unmigrated records`,
        error,
      );
      cache.stopWriting();
      return false;
    }
  }
  for (const [name] of before) if (!records.has(name)) cache.delete(name);
  for (const [name, value] of records) {
    if (value === undefined) cache.delete(name);
    else cache.set(name, value);
  }
  cache.set(VERSION_RECORD, target);
  return true;
}

/**
 * Keep `cache` at this build's version while other writers change it. A
 * version past `migrations.length`, from a newer build in another tab, stops
 * persisting: this build would otherwise keep writing the old shape. A version
 * below it, from an older build or from records read after the open, runs the
 * migrations over the records other writers have changed, which leaves out
 * what this build set itself. Returns the unsubscribe.
 */
export function watchPrefsVersion(
  cache: OwnedRecordCache,
  migrations: readonly PrefsMigration[],
): () => void {
  const target = migrations.length;
  // A version record another writer deleted is a cleared store, whose
  // remaining records are this build's shape, not version 0.
  let versioned = cache.has(VERSION_RECORD);
  const theirs = new Set<string>();
  const heard = (version: unknown): void => {
    if (!isVersion(version)) {
      console.warn(
        `[prefs] "${cache.prefix}" has an unreadable ${VERSION_RECORD} (${JSON.stringify(version)}) from another writer; no longer persisting`,
      );
      cache.stopWriting();
    } else if (version > target) {
      console.warn(
        `[prefs] "${cache.prefix}" was migrated to version ${version} by another writer; this build knows ${target}; no longer persisting`,
      );
      cache.stopWriting();
    }
  };
  // A newer version counts even where this cache kept its own write over it.
  const stopOverruled = cache.onOverruled((changes) => {
    for (const [name, value] of changes) if (name === VERSION_RECORD && value !== undefined) heard(value);
  });
  const stopChanges = cache.subscribe((changes) => {
    const remote = changes.filter((change) => change.origin === 'remote');
    for (const change of remote) {
      if (change.name !== VERSION_RECORD) theirs.add(change.name);
      else if (change.value !== undefined) heard(change.value);
    }
    const cleared = versioned && !cache.has(VERSION_RECORD);
    versioned ||= cache.has(VERSION_RECORD);
    if (remote.length === 0 || cleared || !cache.writable) return;
    if (runPrefsMigrations(cache, migrations, theirs)) {
      theirs.clear();
      void cache.flush();
    }
  });
  return () => {
    stopOverruled();
    stopChanges();
  };
}
