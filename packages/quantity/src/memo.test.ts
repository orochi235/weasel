import { afterEach, describe, expect, it, vi } from 'vitest';
import { fieldLocale } from './fieldLocale';
import { remembered } from './memo';
import { decimalOf } from './number';

describe('remembered', () => {
  it('makes an entry once, and lets the least recently used go past the limit', () => {
    const cache = new Map<string, number>();
    const make = vi.fn(() => cache.size);
    remembered(cache, 'a', make, 2);
    remembered(cache, 'b', make, 2);
    remembered(cache, 'a', make, 2);
    remembered(cache, 'c', make, 2);
    expect([...cache.keys()]).toEqual(['a', 'c']);
    expect(make).toHaveBeenCalledTimes(3);
  });
});

describe('per-locale caches stay bounded', () => {
  afterEach(() => vi.restoreAllMocks());
  const tags = Array.from({ length: 200 }, (_, i) => `en-US-x-t${i}`);

  it('reads a number shape afresh once many other locales have pushed it out', () => {
    decimalOf('en-GB');
    for (const tag of tags) decimalOf(tag);
    const read = vi.spyOn(Intl, 'NumberFormat');
    decimalOf('en-GB');
    expect(read).toHaveBeenCalled();
  });

  it('settles a field locale afresh once many other tags have pushed it out', () => {
    fieldLocale('en-AU');
    for (const tag of tags) fieldLocale(tag);
    const probe = vi.spyOn(Intl, 'getCanonicalLocales');
    expect(fieldLocale('en-AU')).toBe('en-AU');
    expect(probe).toHaveBeenCalled();
  });
});
