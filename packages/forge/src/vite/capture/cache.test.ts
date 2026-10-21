import { describe, expect, it } from 'vitest';
import { createCaptureCache } from './cache';

const png = (bytes: number) => Buffer.alloc(bytes);
const MB = 1024 * 1024;

describe('createCaptureCache', () => {
  it('evicts least recently used past 64 entries', () => {
    const cache = createCaptureCache();
    for (let i = 0; i < 64; i += 1) cache.set(`k${i}`, png(10));
    // Reading k1 leaves k0 the least recently used.
    expect(cache.get('k1')).toBeDefined();
    cache.set('k64', png(10));
    expect(cache.size).toBe(64);
    expect(cache.get('k0')).toBeUndefined();
    expect(cache.get('k1')).toBeDefined();
    expect(cache.get('k64')).toBeDefined();
  });

  it('evicts by bytes past 64 MB even under 64 entries', () => {
    const cache = createCaptureCache();
    cache.set('a', png(40 * MB));
    cache.set('b', png(40 * MB));
    expect(cache.size).toBe(1);
    expect(cache.bytes).toBe(40 * MB);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeDefined();
  });

  it('keeps no image larger than the whole byte budget', () => {
    const cache = createCaptureCache({ entries: 4, bytes: 100 });
    cache.set('small', png(10));
    cache.set('huge', png(101));
    expect(cache.get('huge')).toBeUndefined();
    expect(cache.get('small')).toBeDefined();
  });

  it('replaces an entry under the same key without counting it twice', () => {
    const cache = createCaptureCache({ entries: 4, bytes: 100 });
    cache.set('a', png(30));
    cache.set('a', png(50));
    expect(cache.size).toBe(1);
    expect(cache.bytes).toBe(50);
  });

  it('empties on clear', () => {
    const cache = createCaptureCache();
    cache.set('a', png(10));
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.bytes).toBe(0);
    expect(cache.get('a')).toBeUndefined();
  });
});
