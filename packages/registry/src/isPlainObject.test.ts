import { describe, expect, it } from 'vitest';
import { runInNewContext } from 'node:vm';
import { isPlainObject } from './isPlainObject';

describe('isPlainObject', () => {
  it('accepts a literal and a null-prototype object', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject(Object.create(null))).toBe(true);
  });

  it('accepts a plain object from another realm', () => {
    expect(isPlainObject(runInNewContext('({ a: 1 })'))).toBe(true);
    expect(isPlainObject(structuredClone({ a: 1 }))).toBe(true);
  });

  it('rejects an object whose prototype is a bare null-prototype object', () => {
    expect(isPlainObject(Object.create(Object.create(null)))).toBe(false);
  });

  it('rejects arrays, null, primitives, and class instances', () => {
    for (const v of [[], null, undefined, 'x', 1, new Date(), new Map(), new (class A {})()]) {
      expect(isPlainObject(v)).toBe(false);
    }
  });
});
