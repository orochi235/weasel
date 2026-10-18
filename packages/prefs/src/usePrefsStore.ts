import type { OwnedRecordCache, StorageAdapter, SyncStorageAdapter } from '@weasel-js/storage';
import { useCallback, useSyncExternalStore } from 'react';
import type { PrefGroup } from './groups';
import { openPrefsCacheSync, type PrefsOptions } from './open';
import { createPrefsStore, type PrefsStore } from './store';

/** The store open for one schema, and how many mounted components hold it. */
interface Held {
  store: PrefsStore<PrefGroup> | null;
  holders: number;
}

/** The one cache open on a prefix, and a store over it for each schema in use. */
interface Shared {
  open: { cache: OwnedRecordCache; stop: () => void } | null;
  bySchema: Map<PrefGroup, Held>;
}

/** The store options `usePrefsStore` takes: a store's, with the synchronous storage it reads at once. */
export type UsePrefsStoreOptions = PrefsOptions & { storage: SyncStorageAdapter };

const shared = new WeakMap<StorageAdapter, Map<string, Shared>>();

function sharedAt(storage: StorageAdapter, prefix: string): Shared {
  let byPrefix = shared.get(storage);
  if (!byPrefix) shared.set(storage, (byPrefix = new Map()));
  let entry = byPrefix.get(prefix);
  if (!entry) byPrefix.set(prefix, (entry = { open: null, bySchema: new Map() }));
  return entry;
}

function heldAt(at: Shared, schema: PrefGroup): Held {
  let entry = at.bySchema.get(schema);
  if (!entry) at.bySchema.set(schema, (entry = { store: null, holders: 0 }));
  return entry;
}

/** `cache` for one store among several: closing it sends queued writes and
 *  leaves the cache open for the others. */
const lent = (cache: OwnedRecordCache): OwnedRecordCache =>
  Object.create(cache, {
    close: {
      value: async (): Promise<void> => {
        await cache.flush();
      },
    },
  }) as OwnedRecordCache;

/** Close a store nothing holds, and the cache once no store is over it, a
 *  microtask on: after the remount StrictMode and fast refresh make in the
 *  same tick, which holds it again. */
function closeUnheldSoon(storage: StorageAdapter, prefix: string, schema: PrefGroup, entry: Held): void {
  queueMicrotask(() => {
    if (entry.holders > 0) return;
    void entry.store?.close();
    entry.store = null;
    const byPrefix = shared.get(storage);
    const at = byPrefix?.get(prefix);
    if (!at || !byPrefix) return;
    if (at.bySchema.get(schema) === entry) at.bySchema.delete(schema);
    if (at.bySchema.size > 0) return;
    at.open?.stop();
    // `close` sends queued writes before its first await, and a sync adapter's
    // write lands in that call, so a cache opened next reads them.
    void at.open?.cache.close();
    byPrefix.delete(prefix);
  });
}

function acquire<S extends PrefGroup>(schema: S, options: UsePrefsStoreOptions): PrefsStore<S> {
  const { storage, prefix } = options;
  const at = sharedAt(storage, prefix);
  const entry = heldAt(at, schema);
  if (!entry.store) {
    at.open ??= openPrefsCacheSync(options);
    entry.store = createPrefsStore(
      schema,
      lent(at.open.cache),
      options.validators,
      undefined,
      options.migrations?.length ?? 0,
      options.blends,
    ) as unknown as PrefsStore<PrefGroup>;
    // Opened by a render that may never mount.
    if (entry.holders === 0) closeUnheldSoon(storage, prefix, schema, entry);
  }
  return entry.store as unknown as PrefsStore<S>;
}

/**
 * A store for `schema`, open while the component is mounted: opened during
 * the first render, so that render has values, and closed, with its queued
 * writes sent, when the component unmounts.
 *
 * Components naming the same `storage`, `prefix`, and `schema` share one
 * store, which closes when the last of them unmounts. Components naming the
 * same `storage` and `prefix` with different schemas each get a store of
 * their own over the same records, so a write through one is read by the
 * others at once, and each hears it as a `local` change. They must pass the
 * same `migrations`: the records are migrated once, when the first opens.
 *
 * `storage` and `schema` are compared by identity and `prefix` by value, so
 * keep the first two out of the render body. A change to any of the three
 * closes the store and returns the one for the new three. The `options`
 * object itself may be new every render: `migrations` and `validators` are
 * read when a store opens, and a change to either alone opens nothing.
 */
export function usePrefsStore<S extends PrefGroup>(schema: S, options: UsePrefsStoreOptions): PrefsStore<S> {
  const { storage, prefix } = options;
  const hold = useCallback(() => {
    const entry = heldAt(sharedAt(storage, prefix), schema);
    entry.holders++;
    return () => {
      if (--entry.holders === 0) closeUnheldSoon(storage, prefix, schema, entry);
    };
  }, [storage, prefix, schema]);
  // Read again once held, so a store closed between render and mount is
  // replaced before anything uses it.
  const current = () => acquire(schema, options);
  return useSyncExternalStore(hold, current, current);
}
