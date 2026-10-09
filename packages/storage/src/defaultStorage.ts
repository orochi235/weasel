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

let resolvedDefault: Promise<StorageAdapter> | null = null;

/** IndexedDB under the default database, or localStorage where it will not
 *  open. Resolved once per page. */
export function defaultStorage(): Promise<StorageAdapter> {
  resolvedDefault ??= fallbackStorage(indexedDbAdapter, localStorageAdapter, 'IndexedDB');
  return resolvedDefault;
}

/** Forget which default was chosen. Tests only. */
export function resetDefaultStorage(): void {
  resolvedDefault = null;
}
