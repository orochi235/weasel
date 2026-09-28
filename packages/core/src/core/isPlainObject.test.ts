// @vitest-environment node
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { isPlainObject } from './isPlainObject';

describe('isPlainObject', () => {
  it('takes literals and null-prototype objects', () => {
    expect(isPlainObject({ a: 1 })).toBe(true);
    expect(isPlainObject(Object.create(null))).toBe(true);
  });

  it('takes a plain object made in another realm', () => {
    const foreign = runInNewContext('({ a: 1 })') as object;
    expect(Object.getPrototypeOf(foreign)).not.toBe(Object.prototype);
    expect(isPlainObject(foreign)).toBe(true);
  });

  it('refuses class instances, arrays, and non-objects, from either realm', () => {
    class Point { x = 0; }
    expect(isPlainObject(new Point())).toBe(false);
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject(new Map())).toBe(false);
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject('a')).toBe(false);
    expect(isPlainObject(runInNewContext('new (class P {})()'))).toBe(false);
    expect(isPlainObject(runInNewContext('[]'))).toBe(false);
  });
});
