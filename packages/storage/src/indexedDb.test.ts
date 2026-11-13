import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createIndexedDbAdapter } from './indexedDb';

let n = 0;
const fresh = (): string => `reopen-${n++}`;

/** The connection the adapter's `index`-th `indexedDB.open` produced. */
const connection = (open: { mock: { results: { value: unknown }[] } }, index = 0): IDBDatabase =>
  (open.mock.results[index]!.value as IDBOpenDBRequest).result;

describe('createIndexedDbAdapter — reopening', () => {
  afterEach(() => vi.restoreAllMocks());

  it('opens again after an open that failed', async () => {
    const adapter = createIndexedDbAdapter({ database: fresh() });
    vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
      throw new DOMException('no', 'UnknownError');
    });
    await expect(adapter.list('x')).rejects.toThrow('no');
    expect(await adapter.list('x')).toEqual([]);
  });

  it('opens again once the browser closes the connection', async () => {
    const open = vi.spyOn(indexedDB, 'open');
    const adapter = createIndexedDbAdapter({ database: fresh() });
    await adapter.set('a', 1);
    const db = connection(open);
    db.close();
    db.onclose?.(new Event('close'));
    expect(await adapter.get('a')).toBe(1);
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('opens again when the connection turns out to be closed', async () => {
    const open = vi.spyOn(indexedDB, 'open');
    const adapter = createIndexedDbAdapter({ database: fresh() });
    await adapter.set('a', 1);
    connection(open).close();
    expect(await adapter.get('a')).toBe(1);
  });

  it('lets another connection delete the database, and opens a new one after', async () => {
    const database = fresh();
    const adapter = createIndexedDbAdapter({ database });
    await adapter.set('a', 1);
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(database);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('blocked'));
    });
    expect(await adapter.get('a')).toBeUndefined();
    await adapter.set('a', 2);
    expect(await adapter.get('a')).toBe(2);
  });
});

describe('createIndexedDbAdapter — stores and versions', () => {
  it('adds a second store to a database that already has one', async () => {
    const database = fresh();
    const records = createIndexedDbAdapter({ database, store: 'records' });
    await records.set('a', 1);
    const thumbs = createIndexedDbAdapter({ database, store: 'thumbs' });
    await thumbs.set('a', 2);
    expect(await thumbs.get('a')).toBe(2);
    expect(await records.get('a')).toBe(1);
    await records.set('b', 3);
    expect(await records.list('')).toEqual([['a', 1], ['b', 3]]);
  });

  it('opens a database another writer has taken past version 1', async () => {
    const database = fresh();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(database, 3);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('records').put(7, 'k');
      };
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
    const adapter = createIndexedDbAdapter({ database });
    expect(await adapter.get('k')).toBe(7);
  });
});

describe('createIndexedDbAdapter — a blocked upgrade', () => {
  afterEach(() => vi.restoreAllMocks());

  it('says it is waiting on another connection, and lands once that one closes', async () => {
    const database = fresh();
    // A connection, as another tab's might be, that ignores a request to upgrade.
    const other = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(database, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('records');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const thumbs = createIndexedDbAdapter({ database, store: 'thumbs' });
    const written = thumbs.set('a', 1);
    await vi.waitFor(() => expect(warn).toHaveBeenCalledTimes(1));
    expect(String(warn.mock.calls[0]![0])).toMatch(/waits for another tab/);
    other.close();
    await written;
    expect(await thumbs.get('a')).toBe(1);
  });
});
