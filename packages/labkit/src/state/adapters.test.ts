import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMemoryAdapter,
  localStorageAdapter,
  noneAdapter,
  sessionStorageAdapter,
  urlHashAdapter,
} from './adapters';

describe('localStorageAdapter', () => {
  beforeEach(() => localStorage.clear());

  it('writes and reads a value', () => {
    localStorageAdapter.write('k', 'v');
    expect(localStorageAdapter.read('k')).toBe('v');
  });

  it('returns null for missing key', () => {
    expect(localStorageAdapter.read('missing')).toBeNull();
  });

  it('deletes a key', () => {
    localStorageAdapter.write('k', 'v');
    localStorageAdapter.delete?.('k');
    expect(localStorageAdapter.read('k')).toBeNull();
  });

  it('handles QuotaExceededError gracefully', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('QuotaExceeded', 'QuotaExceededError');
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => localStorageAdapter.write('k', 'v')).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('sessionStorageAdapter', () => {
  beforeEach(() => sessionStorage.clear());

  it('writes and reads a value', () => {
    sessionStorageAdapter.write('k', 'v');
    expect(sessionStorageAdapter.read('k')).toBe('v');
  });
});

describe('urlHashAdapter', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  it('writes and reads back through the hash', () => {
    urlHashAdapter.write('any-key', 'hello world');
    expect(urlHashAdapter.read('any-key')).toBe('hello world');
  });

  it('returns null when hash is empty', () => {
    expect(urlHashAdapter.read('any-key')).toBeNull();
  });

  it('uses replaceState (not pushState)', () => {
    const spy = vi.spyOn(window.history, 'replaceState');
    urlHashAdapter.write('k', 'v');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('createMemoryAdapter', () => {
  it('two instances are isolated', () => {
    const a = createMemoryAdapter();
    const b = createMemoryAdapter();
    a.write('k', 'from-a');
    expect(b.read('k')).toBeNull();
  });

  it('delete removes the key', () => {
    const m = createMemoryAdapter();
    m.write('k', 'v');
    m.delete?.('k');
    expect(m.read('k')).toBeNull();
  });
});

describe('noneAdapter', () => {
  it('read always returns null', () => {
    expect(noneAdapter.read('anything')).toBeNull();
  });

  it('write is a no-op', () => {
    expect(() => noneAdapter.write('k', 'v')).not.toThrow();
  });
});
