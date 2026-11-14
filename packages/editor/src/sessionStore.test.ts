import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRecordCache, type SyncStorageAdapter } from '@weasel-js/storage';
import { readStored, writeSession } from './sessionStore';

describe('readStored', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  const read = (value: unknown): number => {
    if (typeof value !== 'number') throw new Error('not a number');
    return value;
  };

  it('reads the entry under its key', () => {
    localStorage.setItem('k', '7');
    expect(readStored('k', read, () => 0)).toBe(7);
  });

  it('falls back when there is no entry, when read throws, and when storage is unreachable', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(readStored('k', read, () => -1)).toBe(-1);
    localStorage.setItem('k', '"seven"');
    expect(readStored('k', read, () => -2)).toBe(-2);
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('denied'); });
    expect(readStored('k', read, () => -3)).toBe(-3);
  });

  it('hands read a copy it may change', () => {
    const records = createRecordCache({ storage: memory(new Map()), prefix: '', initial: [['k', { n: 1 }]] });
    readStored('k', (value) => { (value as { n: number }).n = 2; return 0; }, () => 0, records);
    expect(records.get('k')).toEqual({ n: 1 });
  });

  it('keeps an entry read throws on aside, as writeSession keeps the document a failed write would cost, and says so once', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem('k', '"seven"');
    expect(readStored('k', read, () => -1)).toBe(-1);
    expect(readStored('k', read, () => -1)).toBe(-1);
    // The fallback's autosave then writes over the key; the entry it could not read survives beside it.
    localStorage.setItem('k', '0');
    expect(localStorage.getItem('k:unreadable')).toBe('"seven"');
    expect(error).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('"k:unreadable"'), expect.any(Error));
  });

  it('keeps an unreadable entry aside in the records it was read from', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const records = createRecordCache({ storage: memory(new Map()), prefix: 'app:', initial: [['k', 'seven']] });
    expect(readStored('k', read, () => -1, records)).toBe(-1);
    expect(records.get('k:unreadable')).toBe('seven');
  });
});

/** A store that refuses writes to the keys in `full`, as a quota error does. */
function memory(data: Map<string, unknown>, full: readonly string[] = []): SyncStorageAdapter {
  const listSync = (prefix: string): [string, unknown][] => [...data].filter(([k]) => k.startsWith(prefix));
  return {
    get: async (k) => data.get(k),
    list: async (prefix) => listSync(prefix),
    listSync,
    set: async (k, v) => {
      if (full.includes(k)) throw new DOMException('full', 'QuotaExceededError');
      data.set(k, v);
    },
    delete: async (k) => { data.delete(k); },
  };
}

const OLD = { scene: 'scene-1', modes: 'modes-1', undo: 'undo-1' };
async function write(full: readonly string[]): Promise<[boolean, Record<string, unknown>]> {
  const data = new Map<string, unknown>(Object.entries(OLD));
  const records = createRecordCache({ storage: memory(data, full), prefix: '', initial: data, retryMs: false });
  const ok = await writeSession(['scene', 'scene-2'], [['modes', 'modes-2'], ['undo', 'undo-2']], records);
  await records.close();
  return [ok, Object.fromEntries(data)];
}

describe('writeSession', () => {
  it('writes the scene and every history, and answers true', async () => {
    expect(await write([])).toEqual([true, { scene: 'scene-2', modes: 'modes-2', undo: 'undo-2' }]);
  });

  it('drops every history when one fails to save beside a new scene', async () => {
    expect(await write(['undo'])).toEqual([true, { scene: 'scene-2' }]);
  });

  it('keeps the previous scene and its histories when the scene fails to save, and answers false', async () => {
    expect(await write(['scene'])).toEqual([false, OLD]);
  });

  it('writes to localStorage when given no records', async () => {
    localStorage.setItem('scene', '"scene-1"');
    expect(await writeSession(['scene', { n: 2 }], [['undo', [1]]])).toBe(true);
    expect([localStorage.getItem('scene'), localStorage.getItem('undo')]).toEqual(['{"n":2}', '[1]']);
    localStorage.clear();
  });
});
