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
