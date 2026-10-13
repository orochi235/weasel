import type { StorageAdapter, SyncStorageAdapter } from '@weasel-js/storage';
import { useCallback, useSyncExternalStore } from 'react';
import type { PrefGroup } from './groups';
import { openPrefsSync, type PrefsOptions } from './open';
import type { PrefsStore } from './store';

/** The one store open on a prefix, and how many mounted components hold it. */
interface Held {
  schema: PrefGroup | null;
  store: PrefsStore<PrefGroup> | null;
  holders: number;
  /** The schemas mounted components hold the prefix with, and how many hold each. */
  schemas: Map<PrefGroup, number>;
}

const held = new WeakMap<StorageAdapter, Map<string, Held>>();

function heldAt(storage: StorageAdapter, prefix: string): Held {
  let byPrefix = held.get(storage);
  if (!byPrefix) held.set(storage, (byPrefix = new Map()));
  let entry = byPrefix.get(prefix);
  if (!entry) byPrefix.set(prefix, (entry = { schema: null, store: null, holders: 0, schemas: new Map() }));
  return entry;
}

// `close` sends queued writes before its first await, and a sync adapter's
// write lands in that call, so a store opened next reads them.
function close(entry: Held): void {
  void entry.store?.close();
  entry.store = null;
}

/** Close an entry nothing holds, a microtask on: after the remount StrictMode
 *  and fast refresh make in the same tick, which holds it again. */
function closeUnheldSoon(storage: StorageAdapter, prefix: string, entry: Held): void {
  queueMicrotask(() => {
    if (entry.holders > 0) return;
    close(entry);
    const byPrefix = held.get(storage);
    if (byPrefix?.get(prefix) === entry) byPrefix.delete(prefix);
  });
}

function acquire<S extends PrefGroup>(
  schema: S,
  options: PrefsOptions & { storage: SyncStorageAdapter },
): PrefsStore<S> {
  const { storage, prefix } = options;
  const entry = heldAt(storage, prefix);
  if (entry.store && entry.schema !== schema) close(entry);
  if (!entry.store) {
    entry.schema = schema;
    entry.store = openPrefsSync(schema, options) as unknown as PrefsStore<PrefGroup>;
    // Opened by a render that may never mount.
    if (entry.holders === 0) closeUnheldSoon(storage, prefix, entry);
  }
  return entry.store as unknown as PrefsStore<S>;
}

/**
 * A store for `schema`, open while the component is mounted: opened during
 * the first render, so that render has values, and closed, with its queued
 * writes sent, when the component unmounts.
 *
 * One store is open per `storage` and `prefix` at a time. Components naming
 * the same pair share it, and it closes when the last of them unmounts; they
 * must pass the same `schema`, and a second one mounting with another warns.
 *
 * `storage` and `schema` are compared by identity and `prefix` by value, so
 * keep the first two out of the render body. A change to `storage` or
 * `prefix` closes the store and returns the one for the new pair. A new
 * `schema` on the same pair closes the store and opens another in the same
 * render, which any other component still holding the old one does not hear
 * of. The `options` object itself may be new every render: `migrations` and
 * `validators` are read when a store opens, and a change to either alone
 * opens nothing.
 */
export function usePrefsStore<S extends PrefGroup>(
  schema: S,
  options: PrefsOptions & { storage: SyncStorageAdapter },
): PrefsStore<S> {
  const { storage, prefix } = options;
  const hold = useCallback(() => {
    const entry = heldAt(storage, prefix);
    entry.holders++;
    entry.schemas.set(schema, (entry.schemas.get(schema) ?? 0) + 1);
    if (entry.schemas.size > 1) {
      console.warn(
        `[prefs] two mounted usePrefsStore callers name the prefix "${prefix}" with different schemas; the store one of them holds is now closed`,
      );
    }
    return () => {
      const left = entry.schemas.get(schema)! - 1;
      if (left === 0) entry.schemas.delete(schema);
      else entry.schemas.set(schema, left);
      if (--entry.holders === 0) closeUnheldSoon(storage, prefix, entry);
    };
  }, [storage, prefix, schema]);
  // Read again once held, so a store closed between render and mount is
  // replaced before anything uses it.
  const current = () => acquire(schema, options);
  return useSyncExternalStore(hold, current, current);
}
