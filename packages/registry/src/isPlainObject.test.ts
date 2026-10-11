import { describe, expect, it } from 'vitest';
import { isPlainObject } from './isPlainObject';

describe('isPlainObject', () => {
  it('accepts a literal and a null-prototype object', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject(Object.create(null))).toBe(true);
  });

  it('accepts a plain object from another realm', () => {
    // A foreign realm's Object.prototype: a prototype whose own prototype is null.
    const foreign = Object.create(Object.create(null));
    expect(isPlainObject(foreign)).toBe(true);
    expect(isPlainObject(structuredClone({ a: 1 }))).toBe(true);
  });

  it('rejects arrays, null, primitives, and class instances', () => {
    for (const v of [[], null, undefined, 'x', 1, new Date(), new Map(), new (class A {})()]) {
      expect(isPlainObject(v)).toBe(false);
    }
  });
});
