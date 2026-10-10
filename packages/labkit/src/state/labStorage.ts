import { createDefaultStorage, createIndexedDbAdapter, type StorageAdapter } from '@weasel-js/storage';

/** IndexedDB under labkit's own database, where every lab before
 *  `@weasel-js/storage` existed kept its records. */
export const indexedDbAdapter: StorageAdapter = createIndexedDbAdapter({ database: 'labkit' });

/** What a lab given only a `storageKey` persists to: IndexedDB, or
 *  localStorage — with a warning — where IndexedDB will not open. */
export const { defaultStorage, resetDefaultStorage } = createDefaultStorage(indexedDbAdapter, 'IndexedDB');
