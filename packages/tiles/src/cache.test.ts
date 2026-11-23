import { describe, expect, it } from 'vitest';
import { TileCache, tileMeets } from './cache';
import { createPlaneScheme } from './scheme';

describe('TileCache', () => {
  it('keeps a payload put again in its own place, freeing it only when replaced by another', () => {
    const freed: string[] = [];
    const cache = new TileCache<{ z: number; x: number; y: number }, { name: string }>(createPlaneScheme(256), {
      bytesOf: () => 1, release: (p) => { freed.push(p.name); },
    });
    const key = { z: 0, x: 0, y: 0 };
    const a = { name: 'a' };
    cache.put(key, a, 1, 0);
    cache.put(key, a, 2, 0);
    expect(freed).toEqual([]);
    expect(cache.bytes).toBe(1);
    cache.put(key, { name: 'b' }, 3, 0);
    expect(freed).toEqual(['a']);
  });

  it('carries a replaced tile\'s arrival forward, so a rebake mid-fade keeps fading', () => {
    const cache = new TileCache<{ z: number; x: number; y: number }, object>(createPlaneScheme(256), {
      bytesOf: () => 1, release: () => {},
    });
    const key = { z: 0, x: 0, y: 0 };
    cache.put(key, {}, 1, 100);
    expect(cache.put(key, {}, 2, 150).bornAt).toBe(100);
  });

  it('grows a box by its pad even where the pad is smaller than a coordinate\'s precision', () => {
    const scheme = createPlaneScheme(512);
    const key = { z: 50, x: 2 ** 49, y: 0 };
    const left = scheme.boundsOf(key)[0]!;
    expect(tileMeets(scheme, key, [left - 1, 0, left, 1e-13], 1)).toBe(true);
    expect(tileMeets(scheme, key, [left - 1, 0, left, 1e-13], 0)).toBe(false);
  });
});
