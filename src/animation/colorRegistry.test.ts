import { describe, expect, it } from 'vitest';
import { ColorOverrideRegistry } from './colorRegistry';

describe('ColorOverrideRegistry', () => {
  it('set + get round-trips an array override', () => {
    const r = new ColorOverrideRegistry();
    r.set('a', 'fill', [1, 2, 3, 4]);
    expect(r.get('a', 'fill')).toEqual([1, 2, 3, 4]);
  });

  it('set + get round-trips a function override', () => {
    const r = new ColorOverrideRegistry();
    const fn = (base: readonly number[]) => base.slice();
    r.set('a', 'stroke', fn);
    expect(r.get('a', 'stroke')).toBe(fn);
  });

  it('clear removes one channel without affecting the other', () => {
    const r = new ColorOverrideRegistry();
    r.set('a', 'fill', [1, 2, 3, 4]);
    r.set('a', 'stroke', [5, 6, 7, 8]);
    r.clear('a', 'fill');
    expect(r.get('a', 'fill')).toBeUndefined();
    expect(r.get('a', 'stroke')).toEqual([5, 6, 7, 8]);
  });

  it('clearAll removes every override', () => {
    const r = new ColorOverrideRegistry();
    r.set('a', 'fill', [1, 2, 3, 4]);
    r.set('b', 'stroke', [5, 6, 7, 8]);
    r.clearAll();
    expect(r.get('a', 'fill')).toBeUndefined();
    expect(r.get('b', 'stroke')).toBeUndefined();
  });

  it('version increments on set and clear', () => {
    const r = new ColorOverrideRegistry();
    const v0 = r.version();
    r.set('a', 'fill', [1, 2, 3, 4]);
    expect(r.version()).toBeGreaterThan(v0);
    const v1 = r.version();
    r.clear('a', 'fill');
    expect(r.version()).toBeGreaterThan(v1);
  });
});
