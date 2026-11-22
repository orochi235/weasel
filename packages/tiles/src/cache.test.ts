import { describe, expect, it } from 'vitest';
import { TileCache } from './cache';
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
});
