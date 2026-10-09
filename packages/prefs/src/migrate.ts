import type { OwnedRecordCache } from '@weasel-js/storage';
import { VERSION_RECORD } from './store';

const isVersion = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

/** Takes stored records from one version to the next: rename, transform or
 *  delete entries in `records`, keyed by leaf path. */
export type PrefsMigration = (records: Map<string, unknown>) => void;

/**
 * Bring `cache` up to `migrations.length`, the current version. Every record
 * a migration leaves is written back, so a migration may replace values or
 * mutate them in place. Stops writing, and writes nothing, when the stored
 * version is newer than this build knows or a migration throws.
 */
export function runPrefsMigrations(
  cache: OwnedRecordCache,
  migrations: readonly PrefsMigration[],
): void {
  const target = migrations.length;
  const raw = cache.get(VERSION_RECORD);
  if (cache.has(VERSION_RECORD) && !isVersion(raw)) {
    console.warn(
      `[prefs] "${cache.prefix}" has an unreadable ${VERSION_RECORD} (${JSON.stringify(raw)}); opening read-only`,
    );
    cache.stopWriting();
    return;
  }
  const stored = cache.has(VERSION_RECORD) ? (raw as number) : 0;
  if (stored > target) {
    console.warn(
      `[prefs] "${cache.prefix}" was written at version ${stored}, newer than this build's ${target}; opening read-only`,
    );
    cache.stopWriting();
    return;
  }
  if (stored === target || !cache.writable) return;

  const before = cache.entries().filter(([name]) => name !== VERSION_RECORD);
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
      return;
    }
  }
  for (const [name] of before) if (!records.has(name)) cache.delete(name);
  for (const [name, value] of records) {
    if (value === undefined) cache.delete(name);
    else cache.set(name, value);
  }
  cache.set(VERSION_RECORD, target);
}

/**
 * Stop persisting when another writer, a newer build in another tab, records a
 * version past `target`: this build would otherwise keep writing the old shape.
 * Returns the unsubscribe.
 */
export function watchPrefsVersion(cache: OwnedRecordCache, target: number): () => void {
  return cache.subscribe((changes) => {
    for (const change of changes) {
      if (change.name !== VERSION_RECORD || !isVersion(change.value) || change.value <= target) continue;
      console.warn(
        `[prefs] "${cache.prefix}" was migrated to version ${change.value} by another writer; this build knows ${target}; no longer persisting`,
      );
      cache.stopWriting();
    }
  });
}
