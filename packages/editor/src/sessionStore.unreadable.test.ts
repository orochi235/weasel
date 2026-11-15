import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createRecordCache, type SyncStorageAdapter } from '@weasel-js/storage';
import { readStored, writeSession } from './sessionStore';
import { useAutosave } from './useAutosave';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
});

const read = (value: unknown): number => {
  if (typeof value !== 'number') throw new Error('not a number');
  return value;
};

/** A store whose writes to the keys `refuse` holds throw, as a quota or permission error does, and whose writes to
 *  the keys `hang` holds never land, as one cut off by the page going away does. */
function store(data: Map<string, unknown>, refuse: Set<string>, hang = new Set<string>()): SyncStorageAdapter {
  const listSync = (prefix: string): [string, unknown][] => [...data].filter(([k]) => k.startsWith(prefix));
  return {
    get: async (k) => data.get(k),
    list: async (prefix) => listSync(prefix),
    listSync,
    set: async (k, v) => {
      if (hang.has(k)) return new Promise(() => {});
      if (refuse.has(k)) throw new DOMException('full', 'QuotaExceededError');
      data.set(k, v);
    },
    delete: async (k) => { data.delete(k); },
  };
}

function session(refuse: Set<string>, hang?: Set<string>) {
  const data = new Map<string, unknown>([['doc', 'seven']]);
  const open = () => createRecordCache({ storage: store(data, refuse, hang), prefix: '', initial: data, retryMs: false });
  return { data, open };
}

describe('an unreadable document', () => {
  it('is not written over while its copy aside fails to save, and saves go through once it lands', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const refuse = new Set(['doc:unreadable']);
    const { data, open } = session(refuse);
    const records = open();
    expect(readStored('doc', read, () => 0, records)).toBe(0);
    expect(await writeSession(['doc', 1], [], records)).toBe(false);
    expect(await writeSession(['doc', 2], [], records)).toBe(false);
    expect(data.get('doc')).toBe('seven');
    expect(data.has('doc:unreadable')).toBe(false);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('could not be kept'));

    refuse.clear();
    expect(await writeSession(['doc', 3], [], records)).toBe(true);
    expect([data.get('doc'), data.get('doc:unreadable')]).toEqual([3, 'seven']);
    expect(await writeSession(['doc', 4], [], records)).toBe(true);
    expect(data.get('doc')).toBe(4);
    await records.close();
  });

  it('is not removed while its copy aside fails to save', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { data, open } = session(new Set(['doc:unreadable']));
    const records = open();
    readStored('doc', read, () => 0, records);
    expect(await writeSession(['doc', undefined], [], records)).toBe(false);
    expect(data.get('doc')).toBe('seven');
    await records.close();
  });

  it('is not written over while its copy aside is still on its way, and survives that copy being cut off', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const hang = new Set(['doc:unreadable']);
    const { data, open } = session(new Set(), hang);
    const first = open();
    readStored('doc', read, () => 0, first);
    let settled = false;
    void writeSession(['doc', 1], [], first).then(() => { settled = true; });
    await new Promise((r) => setTimeout(r, 10));
    expect([settled, data.get('doc'), data.has('doc:unreadable')]).toEqual([false, 'seven', false]);

    // The page went away there. The next visit reads the same document, and keeps it aside this time.
    hang.clear();
    const second = open();
    expect(readStored('doc', read, () => 0, second)).toBe(0);
    expect(await writeSession(['doc', 2], [], second)).toBe(true);
    expect([data.get('doc'), data.get('doc:unreadable')]).toEqual([2, 'seven']);
    await second.close();
  });

  it('is not written over by an autosave while its copy aside fails to save', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { data, open } = session(new Set(['doc:unreadable']));
    const records = open();
    readStored('doc', read, () => 0, records);
    const onSaved = vi.fn();
    const { unmount } = renderHook(() => useAutosave(() => ({ primary: ['doc', 1] }), { records, onSaved, debounceMs: 0 }));
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledWith(false));
    unmount();
    expect(data.get('doc')).toBe('seven');
    await records.close();
  });

  it('in localStorage, is not written over while its copy aside fails to save', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem('k', '"seven"');
    const setItem = Storage.prototype.setItem;
    const refused = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === 'k:unreadable') throw new DOMException('full', 'QuotaExceededError');
      setItem.call(this, key, value);
    });
    expect(readStored('k', read, () => 0)).toBe(0);
    expect(await writeSession(['k', 1])).toBe(false);
    expect(localStorage.getItem('k')).toBe('"seven"');

    refused.mockRestore();
    expect(await writeSession(['k', 2])).toBe(true);
    expect([localStorage.getItem('k'), localStorage.getItem('k:unreadable')]).toEqual(['2', '"seven"']);
    expect(await writeSession(['k', 3])).toBe(true);
    expect(localStorage.getItem('k')).toBe('3');
  });
});
