import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createIndexedDbAdapter, openRecords } from '@weasel-js/storage';
import { DOC_KEY } from './docPersistence';
import { closeSession, openSession, SET_ASIDE_KEY } from './openSession';
import { LS_KEY, SCENE_HISTORY_KEY } from './sceneLoading';
import { sessionRecords } from './sessionRecords';

afterEach(async () => {
  await closeSession();
  vi.restoreAllMocks();
  localStorage.clear();
});

let databases = 0;
const nextDatabase = () => `weaseldraw-open-test-${databases++}`;

/** A saved scene told apart by `tag`, stamped `savedAt` unless that is undefined. */
const scene = (tag: string, savedAt?: number) => ({
  version: 3, nodes: [], doc: { tag }, ...(savedAt === undefined ? {} : { savedAt }),
});

async function seedIndexedDb(database: string, entries: Record<string, unknown>): Promise<void> {
  const records = await openRecords({ storage: createIndexedDbAdapter({ database }), prefix: '' });
  for (const [key, value] of Object.entries(entries)) records.set(key, value);
  await records.flush();
  await records.close();
}

const seedLocalStorage = (entries: Record<string, unknown>): void => {
  for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, JSON.stringify(value));
};

/** The tag of the scene the opened session holds. */
const openedTag = (): unknown => (sessionRecords()?.get(LS_KEY) as { doc: { tag: string } } | undefined)?.doc.tag;
const localKeys = (): (string | null)[] => [LS_KEY, SCENE_HISTORY_KEY, DOC_KEY].map((k) => localStorage.getItem(k));

describe("openSession with a drawing in both IndexedDB and localStorage", () => {
  it('opens the localStorage one when it was saved later, and drops the undo stack and document of the other', async () => {
    const database = nextDatabase();
    await seedIndexedDb(database, { [LS_KEY]: scene('idb', 1_000), [SCENE_HISTORY_KEY]: { version: 1 }, [DOC_KEY]: { filename: 'old.svg' } });
    seedLocalStorage({ [LS_KEY]: scene('local', 2_000) });

    await openSession(database);
    expect(openedTag()).toBe('local');
    expect(sessionRecords()!.has(SCENE_HISTORY_KEY)).toBe(false);
    expect(sessionRecords()!.has(DOC_KEY)).toBe(false);
    expect(localKeys()).toEqual([null, null, null]);
  });

  it('opens the IndexedDB one when it was saved later, and clears the older copy from localStorage', async () => {
    const database = nextDatabase();
    await seedIndexedDb(database, { [LS_KEY]: scene('idb', 2_000) });
    seedLocalStorage({ [LS_KEY]: scene('local', 1_000), [DOC_KEY]: { filename: 'old.svg' } });

    await openSession(database);
    expect(openedTag()).toBe('idb');
    expect(localKeys()).toEqual([null, null, null]);
    expect(sessionRecords()!.has(SET_ASIDE_KEY)).toBe(false);
  });

  it('keeps later IndexedDB edits over a moved copy whose localStorage delete did not land', async () => {
    const database = nextDatabase();
    seedLocalStorage({ [LS_KEY]: scene('moved', 1_000) });
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    await openSession(database);
    expect(openedTag()).toBe('moved');
    expect(localStorage.getItem(LS_KEY)).not.toBeNull();
    removeItem.mockRestore();

    sessionRecords()!.set(LS_KEY, scene('edited', 2_000));
    await sessionRecords()!.flush();
    await closeSession();

    await openSession(database);
    expect(openedTag()).toBe('edited');
    expect(localStorage.getItem(LS_KEY)).toBeNull();
  });

  it('prefers a stamped copy over one saved before copies were stamped, either way round', async () => {
    const first = nextDatabase();
    await seedIndexedDb(first, { [LS_KEY]: scene('idb') });
    seedLocalStorage({ [LS_KEY]: scene('local', 1_000) });
    await openSession(first);
    expect(openedTag()).toBe('local');
    await closeSession();

    const second = nextDatabase();
    await seedIndexedDb(second, { [LS_KEY]: scene('idb', 1_000) });
    seedLocalStorage({ [LS_KEY]: scene('local') });
    await openSession(second);
    expect(openedTag()).toBe('idb');
    expect(localStorage.getItem(LS_KEY)).toBeNull();
    expect((sessionRecords()!.get(SET_ASIDE_KEY) as { doc: { tag: string } }).doc.tag).toBe('local');
  });

  it('opens the IndexedDB one when neither is stamped, keeping a different localStorage drawing aside', async () => {
    const database = nextDatabase();
    await seedIndexedDb(database, { [LS_KEY]: scene('idb') });
    seedLocalStorage({ [LS_KEY]: scene('local') });
    await openSession(database);
    expect(openedTag()).toBe('idb');
    expect((sessionRecords()!.get(SET_ASIDE_KEY) as { doc: { tag: string } }).doc.tag).toBe('local');
    expect(localStorage.getItem(LS_KEY)).toBeNull();
  });

  it('clears an unstamped localStorage copy the same as the IndexedDB one without keeping it aside', async () => {
    const database = nextDatabase();
    await seedIndexedDb(database, { [LS_KEY]: scene('same') });
    seedLocalStorage({ [LS_KEY]: scene('same') });
    await openSession(database);
    expect(openedTag()).toBe('same');
    expect(sessionRecords()!.has(SET_ASIDE_KEY)).toBe(false);
    expect(localStorage.getItem(LS_KEY)).toBeNull();
  });
});
