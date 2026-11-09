import { describe, expect, it } from 'vitest';
import { SpatialHash } from './hash';

describe('SpatialHash', () => {
  it('answers the items whose boxes share a cell with the query', () => {
    const hash = new SpatialHash<string>(10);
    hash.insert('a', { x: 0, y: 0, width: 5, height: 5 });
    hash.insert('b', { x: 100, y: 100, width: 5, height: 5 });
    expect(hash.query({ x: 1, y: 1, width: 1, height: 1 })).toEqual(['a']);
  });

  it('files and finds an item spanning more cells than could be visited, and one with no end', () => {
    const hash = new SpatialHash<string>(10);
    hash.insert('long', { x: 0, y: 0, width: 1e12, height: 0 });
    hash.insert('endless', { x: 0, y: 50, width: Infinity, height: 0 });
    expect(hash.query({ x: 5e11, y: -1, width: 1, height: 2 })).toEqual(['long']);
    expect(hash.query({ x: 1e15, y: 49, width: 1, height: 2 })).toEqual(['endless']);
    hash.remove('long', { x: 0, y: 0, width: 1e12, height: 0 });
    expect(hash.query({ x: 5e11, y: -1, width: 1, height: 2 })).toEqual([]);
  });

  it('files and finds an item so far out that its cell indices stop counting', () => {
    const hash = new SpatialHash<string>(10);
    const far = { x: 1e21, y: 1e21, width: 5, height: 5 };
    hash.insert('far', far);
    expect(hash.query(far)).toEqual(['far']);
    hash.remove('far', far);
    expect(hash.query(far)).toEqual([]);
  });

  it('answers a query spanning more cells than could be visited from what is filed', () => {
    const hash = new SpatialHash<string>(10);
    hash.insert('a', { x: 0, y: 0, width: 5, height: 5 });
    hash.insert('b', { x: 5e8, y: 5e8, width: 5, height: 5 });
    expect(hash.query({ x: -1e9, y: -1e9, width: 1e9 + 10, height: 1e9 + 10 })).toEqual(['a']);
  });
});
