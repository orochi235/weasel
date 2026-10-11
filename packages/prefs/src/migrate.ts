import type { OwnedRecordCache } from '@weasel-js/storage';
import { VERSION_RECORD } from './helpers';
import { readRecord, stampRecord } from './stamp';

const isVersion = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

/** Takes stored values from one version to the next: rename, transform or
 *  delete entries in `records`, keyed by leaf path. It sees the values, not
 *  the stamps they are stored under, and only those at its own version. */
export type PrefsMigration = (records: Map<string, unknown>) => void;

/**
 * Bring `cache` up to `migrations.length`, the current version. Each record
 * is migrated from the version it is stamped with, so one already in this
 * build's shape is left alone and one an older writer left is caught up,
 * whatever the store's version record says. A migration is handed the
 * records that are at its version; every one it leaves is written back
 * stamped with the version reached, so it may replace values or mutate them
 * in place. Stops writing, and writes nothing, when the store or a record is
 * newer than this build knows or a migration throws. Returns whether it wrote.
 *
 * `stampAll` also stamps the records that needed no migration and carry no
 * stamp. An open does that; a watcher does not, since an unstamped record
 * arriving from another writer may be in a version it has yet to announce.
 */
export function runPrefsMigrations(
  cache: OwnedRecordCache,
  migrations: readonly PrefsMigration[],
  { stampAll = true }: { stampAll?: boolean } = {},
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
  const held = cache
    .entries()
    .filter(([name]) => name !== VERSION_RECORD)
    .map(([name, record]) => ({ name, ...readRecord(record, Math.min(stored, target)) }));
  const newest = Math.max(stored, ...held.map((r) => r.at));
  if (newest > target) {
    console.warn(
      `[prefs] "${cache.prefix}" was written at version ${newest}, newer than this build's ${target}; opening read-only`,
    );
    cache.stopWriting();
    return false;
  }
  if (!cache.writable) return false;

  // Where each record now stands, and the records that are behind.
  const at = new Map(held.filter((r) => r.at < target).map((r) => [r.name, r.at]));
  const records = new Map(held.filter((r) => at.has(r.name)).map((r): [string, unknown] => [r.name, structuredClone(r.value)]));
  for (let v = Math.min(target, ...at.values()); v < target; v++) {
    const due = new Map([...records].filter(([name]) => at.get(name)! <= v));
    const before = [...due.keys()];
    try {
      migrations[v]!(due);
    } catch (error) {
      console.warn(
        `[prefs] migration ${v} → ${v + 1} for "${cache.prefix}" threw; opening read-only on the unmigrated records`,
        error,
      );
      cache.stopWriting();
      return false;
    }
    for (const name of before) if (!due.has(name)) records.delete(name);
    for (const [name, value] of due) {
      records.set(name, value);
      at.set(name, v + 1);
    }
  }
  let wrote = false;
  for (const r of held) {
    if (at.has(r.name)) {
      if (!records.has(r.name)) cache.delete(r.name);
      wrote = true;
    } else if (stampAll && !r.stamped) {
      cache.set(r.name, stampRecord(r.value, target));
      wrote = true;
    }
  }
  for (const [name, value] of records) {
    if (value === undefined) cache.delete(name);
    else cache.set(name, stampRecord(value, target));
  }
  if (stored !== target) {
    cache.set(VERSION_RECORD, target);
    wrote = true;
  }
  return wrote;
}

/**
 * Keep `cache` at this build's version while other writers change it. A
 * version past `migrations.length`, from a newer build in another tab, stops
 * persisting: this build would otherwise keep writing the old shape. A record
 * another writer leaves is migrated from the version it is stamped with, as
 * soon as it arrives; one with no stamp, from a build that wrote none, from
 * the version record that writer leaves with it. A version record another
 * writer deleted, a cleared store, is written back. Returns the unsubscribe.
 */
export function watchPrefsVersion(
  cache: OwnedRecordCache,
  migrations: readonly PrefsMigration[],
): () => void {
  const target = migrations.length;
  // Once this cache has held a version, the records it holds are this
  // build's shape, and a missing version record is a cleared store.
  let versioned = cache.has(VERSION_RECORD);
  let stopped = false;
  const migrate = (): void => {
    const cleared = versioned && !cache.has(VERSION_RECORD);
    if (cleared) cache.set(VERSION_RECORD, target);
    else if (!runPrefsMigrations(cache, migrations, { stampAll: false })) return;
    versioned = true;
    void cache.flush();
  };
  // A late first read that finds nothing reports no change to migrate on.
  void cache.whenRead().then(() => {
    if (!stopped && cache.writable) migrate();
  });
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
      if (change.name === VERSION_RECORD && change.value !== undefined) heard(change.value);
    }
    if (remote.length > 0 && cache.writable) migrate();
    versioned ||= cache.has(VERSION_RECORD);
  });
  return () => {
    stopped = true;
    stopOverruled();
    stopChanges();
  };
}
