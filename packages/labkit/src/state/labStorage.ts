import {
  createIndexedDbAdapter,
  fallbackStorage,
  localStorageAdapter,
  type StorageAdapter,
} from '@weasel-js/storage';

/** IndexedDB under labkit's own database, where every lab before
 *  `@weasel-js/storage` existed kept its records. */
export const indexedDbAdapter: StorageAdapter = createIndexedDbAdapter({ database: 'labkit' });

let resolvedDefault: Promise<StorageAdapter> | null = null;

/** What a lab given only a `storageKey` persists to: IndexedDB, or
 *  localStorage — with a warning — where IndexedDB will not open. */
export function defaultStorage(): Promise<StorageAdapter> {
  resolvedDefault ??= fallbackStorage(indexedDbAdapter, localStorageAdapter, 'IndexedDB');
  return resolvedDefault;
}

/** Forget which default was chosen. Tests only. */
export function resetDefaultStorage(): void {
  resolvedDefault = null;
}
