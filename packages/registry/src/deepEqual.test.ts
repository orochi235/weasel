import { describe, expect, it } from 'vitest';
import { deepEqual } from './deepEqual';

describe('deepEqual', () => {
  it('compares plain objects and arrays by content, nested', () => {
    expect(deepEqual({ a: [1, { b: 'x' }] }, { a: [1, { b: 'x' }] })).toBe(true);
    expect(deepEqual({ a: [1, { b: 'x' }] }, { a: [1, { b: 'y' }] })).toBe(false);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(deepEqual([], {})).toBe(false);
    expect(deepEqual(NaN, NaN)).toBe(true);
  });

  it('holds across realms', () => {
    const value = { a: [1, { b: 2 }] };
    expect(deepEqual(structuredClone(value), value)).toBe(true);
    expect(deepEqual(Object.create(Object.create(null)), {})).toBe(true);
  });

  it('compares functions, class instances, dates and maps by identity', () => {
    const f = () => 1;
    expect(deepEqual({ f }, { f })).toBe(true);
    expect(deepEqual({ f }, { f: () => 1 })).toBe(false);
    class P { constructor(readonly x: number) {} }
    expect(deepEqual(new P(1), new P(1))).toBe(false);
    expect(deepEqual(new Date(0), new Date(0))).toBe(false);
  });

  it('counts a key holding undefined as present unless told otherwise', () => {
    expect(deepEqual({ a: 1, b: undefined }, { a: 1 })).toBe(false);
    expect(deepEqual({ a: 1, b: undefined }, { a: 1 }, { undefinedAsAbsent: true })).toBe(true);
    expect(deepEqual({ n: { b: undefined } }, { n: {} }, { undefinedAsAbsent: true })).toBe(true);
  });
});
