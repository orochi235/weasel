import { describe, expect, it } from 'vitest';
import { createColorOverrideRegistry } from './colorRegistry';

describe('ColorOverrideRegistry', () => {
  it('set + get round-trips an array override', () => {
    const r = createColorOverrideRegistry();
    r.set('a', 'fill', [1, 2, 3, 4]);
    expect(r.get('a', 'fill')).toEqual([1, 2, 3, 4]);
  });

  it('set + get round-trips a function override', () => {
    const r = createColorOverrideRegistry();
    const fn = (base: readonly number[]) => base.slice();
    r.set('a', 'stroke', fn);
    expect(r.get('a', 'stroke')).toBe(fn);
  });

  it('notifies nobody for a write of the override a channel holds', () => {
    const r = createColorOverrideRegistry();
    const fn = (base: readonly number[]) => base.slice();
    r.set('a', 'fill', [1, Number.NaN, 3, 4]);
    r.set('a', 'stroke', fn);
    let calls = 0;
    r.subscribe(() => { calls++; });
    const version = r.version();
    r.set('a', 'fill', [1, Number.NaN, 3, 4]);
    r.set('a', 'stroke', fn);
    expect(calls).toBe(0);
    expect(r.version()).toBe(version);
    r.set('a', 'fill', [1, 2, 3, 4]);
    expect(calls).toBe(1);
  });

  it('clear removes one channel without affecting the other', () => {
    const r = createColorOverrideRegistry();
    r.set('a', 'fill', [1, 2, 3, 4]);
    r.set('a', 'stroke', [5, 6, 7, 8]);
    r.clear('a', 'fill');
    expect(r.get('a', 'fill')).toBeUndefined();
    expect(r.get('a', 'stroke')).toEqual([5, 6, 7, 8]);
  });

  it('clearAll removes every override', () => {
    const r = createColorOverrideRegistry();
    r.set('a', 'fill', [1, 2, 3, 4]);
    r.set('b', 'stroke', [5, 6, 7, 8]);
    r.clearAll();
    expect(r.get('a', 'fill')).toBeUndefined();
    expect(r.get('b', 'stroke')).toBeUndefined();
  });

  it('version increments on set and clear', () => {
    const r = createColorOverrideRegistry();
    const v0 = r.version();
    r.set('a', 'fill', [1, 2, 3, 4]);
    expect(r.version()).toBeGreaterThan(v0);
    const v1 = r.version();
    r.clear('a', 'fill');
    expect(r.version()).toBeGreaterThan(v1);
  });

  it('counts a target asked for and never moved as nothing', () => {
    const r = createColorOverrideRegistry();
    r.target('a', 'fill', 4);
    expect(r.has('a')).toBe(false);
  });

  it('tells subscribers of a set and a clear', () => {
    const r = createColorOverrideRegistry();
    let told = 0;
    const off = r.subscribe(() => { told += 1; });
    r.set('a', 'fill', [1, 2, 3, 4]);
    r.clear('a', 'fill');
    expect(told).toBe(2);
    off();
    r.set('a', 'fill', [1, 2, 3, 4]);
    expect(told).toBe(2);
  });
});
