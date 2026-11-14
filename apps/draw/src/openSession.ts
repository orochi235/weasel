import { writeSession } from '@weasel-js/editor';
import { createIndexedDbAdapter, localStorageAdapter, openRecords, type RecordCache } from '@weasel-js/storage';
import { DOC_KEY } from './docPersistence';
import { LS_KEY, SCENE_HISTORY_KEY } from './sceneLoading';
import { holdSessionRecords } from './sessionRecords';

let opening: Promise<RecordCache | undefined> | null = null;

/**
 * Open draw's session in IndexedDB, once per page, and resolve when its records can be read: draw's loads read them
 * synchronously from then on. A session still in `localStorage` is moved across on the first open. Resolves
 * `undefined`, leaving the session in `localStorage`, where IndexedDB will not open.
 */
export function openSession(database = 'weaseldraw'): Promise<RecordCache | undefined> {
  return (opening ??= open(database));
}

async function open(database: string): Promise<RecordCache | undefined> {
  try {
    const records = await openRecords({ storage: createIndexedDbAdapter({ database }), prefix: '' });
    if (!records.writable) {
      records.stopWriting();
      await records.close();
      return undefined;
    }
    await moveFromLocalStorage(records);
    holdSessionRecords(records);
    return records;
  } catch (error) {
    console.warn('weaseldraw: the session would not open in IndexedDB; keeping it in localStorage', error);
    return undefined;
  }
}

/** Copy the session `localStorage` holds into `records` when they hold no scene, and remove it from `localStorage`
 *  once every entry has landed. */
async function moveFromLocalStorage(records: RecordCache): Promise<void> {
  if (records.has(LS_KEY)) return;
  const found: [string, unknown][] = [];
  for (const key of [LS_KEY, SCENE_HISTORY_KEY, DOC_KEY]) {
    try {
      const value = await localStorageAdapter.get(key);
      if (value !== undefined) found.push([key, value]);
    } catch { /* blocked: nothing to move */ }
  }
  const [primary, ...dependents] = found;
  if (!primary) return;
  if (!(await writeSession(primary, dependents, records))) return;
  if (!found.every(([key]) => records.has(key) && !records.pending(key))) return;
  for (const [key] of found) await localStorageAdapter.delete(key).catch(() => {});
}

/** Close the session {@link openSession} opened and forget it, so the next call opens again. For tests. */
export async function closeSession(): Promise<void> {
  const records = await opening;
  opening = null;
  holdSessionRecords(undefined);
  await records?.close();
}
