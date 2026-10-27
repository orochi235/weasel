import { describe, expect, it } from 'vitest';
import { createSettledCache } from '@weasel-js/geom/nd';

describe('createSettledCache', () => {
  it('answers null on the first read at a key and builds on the second', () => {
    const cache = createSettledCache<string>();
    let builds = 0;
    const build = () => `v${++builds}`;
    expect(cache.read([1, 'a'], build)).toBeNull();
    expect(builds).toBe(0);
    expect(cache.read([1, 'a'], build)).toBe('v1');
    expect(cache.read([1, 'a'], build)).toBe('v1');
    expect(builds).toBe(1);
  });

  it('starts over when any element of the key changes, and never builds for a key that changes every read', () => {
    const cache = createSettledCache<number>();
    let builds = 0;
    const build = () => ++builds;
    cache.read([1, 'a'], build);
    expect(cache.read([1, 'a'], build)).toBe(1);
    expect(cache.read([1, 'b'], build)).toBeNull();
    expect(cache.read([2, 'b', 0], build)).toBeNull();
    expect(cache.read([2, 'b'], build)).toBeNull();
    expect(builds).toBe(1);
    expect(cache.read([2, 'b'], build)).toBe(2);
  });

  it('matches keys by identity under Object.is, so a NaN element still settles', () => {
    const cache = createSettledCache<number>();
    const obj = {};
    cache.read([obj, NaN], () => 1);
    expect(cache.read([obj, NaN], () => 1)).toBe(1);
    expect(cache.read([{}, NaN], () => 2)).toBeNull();
  });

  it('copies the key, so a caller reusing its array does not fake a match', () => {
    const cache = createSettledCache<number>();
    const key = [1];
    cache.read(key, () => 1);
    key[0] = 2;
    expect(cache.read(key, () => 1)).toBeNull();
  });

  it('builds on the first read with reads: 1, and on the third with reads: 3', () => {
    const memo = createSettledCache<number>({ reads: 1 });
    expect(memo.read([0], () => 7)).toBe(7);
    const slow = createSettledCache<number>({ reads: 3 });
    expect(slow.read([0], () => 7)).toBeNull();
    expect(slow.read([0], () => 7)).toBeNull();
    expect(slow.read([0], () => 7)).toBe(7);
  });

  it('keeps a value of null or undefined as built', () => {
    const cache = createSettledCache<undefined>({ reads: 1 });
    let builds = 0;
    cache.read([0], () => { builds++; return undefined; });
    cache.read([0], () => { builds++; return undefined; });
    expect(builds).toBe(1);
  });

  it('forgets everything on clear', () => {
    const cache = createSettledCache<number>();
    cache.read([0], () => 1);
    expect(cache.read([0], () => 1)).toBe(1);
    cache.clear();
    expect(cache.read([0], () => 2)).toBeNull();
    expect(cache.read([0], () => 2)).toBe(2);
  });

  it('refuses a reads count that is not a positive integer', () => {
    expect(() => createSettledCache({ reads: 0 })).toThrow(RangeError);
    expect(() => createSettledCache({ reads: 1.5 })).toThrow(RangeError);
  });
});
