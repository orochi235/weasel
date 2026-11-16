import { savedAtOf, writeSession } from '@weasel-js/editor';
import { createIndexedDbAdapter, localStorageAdapter, openRecords, sameStored, type RecordCache } from '@weasel-js/storage';
import { DOC_KEY } from './docPersistence';
import { LS_KEY, SCENE_HISTORY_KEY } from './sceneLoading';
import { holdSessionRecords } from './sessionRecords';

let opening: Promise<RecordCache | undefined> | null = null;

/**
 * Open draw's session in IndexedDB, once per page, and resolve when its records can be read: draw's loads read them
 * synchronously from then on. A session in `localStorage` newer than the one in IndexedDB is moved across
 * ({@link moveFromLocalStorage}). Resolves `undefined`, leaving the session in `localStorage`, where IndexedDB will
 * not open.
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

const SESSION_KEYS = [LS_KEY, SCENE_HISTORY_KEY, DOC_KEY] as const;

/** Where a drawing found in `localStorage` is kept when it lost to the one in IndexedDB without being known to be the
 *  older: it was saved without a `savedAt` stamp, and differs. */
export const SET_ASIDE_KEY = `${LS_KEY}:set-aside`;

/**
 * Bring the session `localStorage` holds into `records` when it is the newer of the two, as it is after a visit where
 * IndexedDB would not open, and remove it from `localStorage` once it has landed or lost. The scene entries'
 * `savedAt` stamps (`savedAtOf`) decide: the later stamp wins, a stamped copy beats an unstamped one, and the copy
 * in IndexedDB wins a tie or when neither is stamped. A losing `localStorage` drawing with no stamp is kept under
 * {@link SET_ASIDE_KEY} before it goes, unless it is the same drawing.
 */
async function moveFromLocalStorage(records: RecordCache): Promise<void> {
  const found = await readLocalSession();
  const local = found.find(([key]) => key === LS_KEY)?.[1];
  if (records.has(LS_KEY)) {
    if (local === undefined) return;
    const kept = records.get(LS_KEY);
    if (!localIsNewer(kept, local)) {
      if (savedAtOf(local) === undefined && !sameStored(kept, local) && !(await setAside(records, local))) return;
      return clearLocal(found);
    }
    // The copy in IndexedDB goes whole: an undo stack or document left from it would load beside the other drawing.
    for (const key of SESSION_KEYS) if (!found.some(([k]) => k === key)) records.delete(key);
    await records.flush();
  }
  const [primary, ...dependents] = found;
  if (!primary) return;
  if (!(await writeSession(primary, dependents, records))) return;
  if (!found.every(([key]) => records.has(key) && !records.pending(key))) return;
  await clearLocal(found);
}

async function readLocalSession(): Promise<[string, unknown][]> {
  const found: [string, unknown][] = [];
  for (const key of SESSION_KEYS) {
    try {
      const value = await localStorageAdapter.get(key);
      if (value !== undefined) found.push([key, value]);
    } catch { /* blocked: nothing to move */ }
  }
  return found;
}

async function clearLocal(found: readonly [string, unknown][]): Promise<void> {
  for (const [key] of found) await localStorageAdapter.delete(key).catch(() => {});
}

/** Keep `scene` under {@link SET_ASIDE_KEY}, and answer whether it landed. */
async function setAside(records: RecordCache, scene: unknown): Promise<boolean> {
  records.set(SET_ASIDE_KEY, scene);
  await records.flush();
  return records.has(SET_ASIDE_KEY) && !records.pending(SET_ASIDE_KEY);
}

/** Whether the scene `localStorage` holds was saved after the one in IndexedDB. A stamped copy was saved by a build
 *  that stamps, after every unstamped one. */
function localIsNewer(inRecords: unknown, inLocal: unknown): boolean {
  const local = savedAtOf(inLocal);
  if (local === undefined) return false;
  const kept = savedAtOf(inRecords);
  return kept === undefined || local > kept;
}

/** Close the session {@link openSession} opened and forget it, so the next call opens again. For tests. */
export async function closeSession(): Promise<void> {
  const records = await opening;
  opening = null;
  holdSessionRecords(undefined);
  await records?.close();
}
