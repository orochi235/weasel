import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { localStorageAdapter, readLocal, writeLocal } from './webStorage';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('readLocal and writeLocal', () => {
  it('read back what they write, as localStorageAdapter does', async () => {
    expect(writeLocal('k', { folded: ['a'] })).toBe(true);
    expect(readLocal('k')).toEqual({ folded: ['a'] });
    expect(await localStorageAdapter.get('k')).toEqual({ folded: ['a'] });
    await localStorageAdapter.set('j', 3);
    expect(readLocal('j')).toBe(3);
  });

  it('read nothing as undefined, and plain text as itself', () => {
    expect(readLocal('absent')).toBeUndefined();
    localStorage.setItem('raw', 'dark mode');
    expect(readLocal('raw')).toBe('dark mode');
  });

  it('remove the key for undefined', () => {
    writeLocal('k', 1);
    expect(writeLocal('k', undefined)).toBe(true);
    expect(localStorage.getItem('k')).toBeNull();
  });

  it('answer undefined and false where the browser refuses storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(readLocal('k')).toBeUndefined();
    expect(writeLocal('k', 1)).toBe(false);
  });
});

describe('readLocal and writeLocal over another area', () => {
  it('read and write it as they do localStorage, and answer a refusal the same way', () => {
    const held = new Map<string, string>();
    const area = {
      getItem: (key: string) => held.get(key) ?? null,
      setItem: (key: string, value: string) => void held.set(key, value),
      removeItem: (key: string) => void held.delete(key),
    };
    expect(writeLocal('k', { a: 1 }, area)).toBe(true);
    expect(held.get('k')).toBe('{"a":1}');
    expect(readLocal('k', area)).toEqual({ a: 1 });
    expect(localStorage.getItem('k')).toBeNull();
    writeLocal('k', undefined, area);
    expect(held.has('k')).toBe(false);
    const full = { ...area, setItem: () => { throw new DOMException('full', 'QuotaExceededError'); } };
    expect(writeLocal('k', 1, full)).toBe(false);
  });
});
