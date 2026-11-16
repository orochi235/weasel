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
