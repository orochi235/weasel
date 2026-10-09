import {
  openRecords,
  openRecordsSync,
  type OwnedRecordCache,
  type StorageAdapter,
  type SyncStorageAdapter,
} from '@weasel-js/storage';
import { type PrefsMigration, runPrefsMigrations, watchPrefsVersion } from './migrate';
import type { PrefValidator } from './repair';
import type { PrefGroup } from './schema';
import { createPrefsStore, type PrefsStore } from './store';

/** Options for `openPrefs` and `openPrefsSync`. */
export interface PrefsOptions {
  storage: StorageAdapter;
  /** Prepended to every record's key: `'myapp.prefs.'`. */
  prefix: string;
  /** `migrations[i]` takes stored records from version `i` to `i + 1`. The
   *  current version is `migrations.length`. */
  migrations?: readonly PrefsMigration[];
  /** Validators for app-defined kinds, keyed by `kind`. One given for a
   *  built-in kind replaces that kind's own rule. */
  validators?: Readonly<Record<string, PrefValidator>>;
}

/** Load every stored value for `schema`, migrate it, and return the store. */
export async function openPrefs<S extends PrefGroup>(
  schema: S,
  options: PrefsOptions,
): Promise<PrefsStore<S>> {
  const cache = await openRecords({ storage: options.storage, prefix: options.prefix });
  if (runPrefsMigrations(cache, options.migrations ?? [])) await cache.flush();
  return finish(schema, cache, options);
}

/** `openPrefs` for an adapter that reads synchronously: the store is ready
 *  on return, so values can be read before anything renders. */
export function openPrefsSync<S extends PrefGroup>(
  schema: S,
  options: PrefsOptions & { storage: SyncStorageAdapter },
): PrefsStore<S> {
  const cache = openRecordsSync({ storage: options.storage, prefix: options.prefix });
  if (runPrefsMigrations(cache, options.migrations ?? [])) void cache.flush();
  return finish(schema, cache, options);
}

function finish<S extends PrefGroup>(
  schema: S,
  cache: OwnedRecordCache,
  options: PrefsOptions,
): PrefsStore<S> {
  const stop = cache.writable ? watchPrefsVersion(cache, (options.migrations ?? []).length) : undefined;
  return createPrefsStore(schema, cache, options.validators, stop);
}
