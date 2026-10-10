import { indexedDbAdapter } from './indexedDb';
import type { StorageAdapter } from './types';
import { localStorageAdapter } from './webStorage';

/** `preferred` if it opens, otherwise `fallback` — with a warning. */
export async function fallbackStorage(
  preferred: StorageAdapter,
  fallback: StorageAdapter = localStorageAdapter,
  label = 'preferred storage',
): Promise<StorageAdapter> {
  try {
    await preferred.list(' ');
    return preferred;
  } catch (error) {
    console.warn(`[storage] ${label} would not open; using the fallback instead`, error);
    return fallback;
  }
}

/** A page-wide default: `preferred`, or localStorage where it will not open,
 *  chosen on first call and kept until `resetDefaultStorage` (tests only). */
export function createDefaultStorage(
  preferred: StorageAdapter,
  label?: string,
): { defaultStorage: () => Promise<StorageAdapter>; resetDefaultStorage: () => void } {
  let resolved: Promise<StorageAdapter> | null = null;
  return {
    defaultStorage: () => (resolved ??= fallbackStorage(preferred, localStorageAdapter, label)),
    resetDefaultStorage: () => {
      resolved = null;
    },
  };
}

/** IndexedDB under the default database, 'weasel', or localStorage where it
 *  will not open. Resolved once per page. */
export const { defaultStorage, resetDefaultStorage } = createDefaultStorage(indexedDbAdapter, 'IndexedDB');
