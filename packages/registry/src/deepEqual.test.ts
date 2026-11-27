import { describe, expect, it } from 'vitest';
import { runInNewContext } from 'node:vm';
import { deepEqual } from './deepEqual';

describe('deepEqual', () => {
  it('compares plain objects and arrays by content, nested', () => {
    expect(deepEqual({ a: [1, { b: 'x' }] }, { a: [1, { b: 'x' }] })).toBe(true);
    expect(deepEqual({ a: [1, { b: 'x' }] }, { a: [1, { b: 'y' }] })).toBe(false);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(deepEqual([], {})).toBe(false);
    expect(deepEqual(NaN, NaN)).toBe(true);
  });

  it('compares symbol-keyed properties', () => {
    const s = Symbol('s');
    expect(deepEqual({ [s]: 1 }, { [s]: 1 })).toBe(true);
    expect(deepEqual({ [s]: 1 }, { [s]: 2 })).toBe(false);
    expect(deepEqual({ [s]: 1 }, {})).toBe(false);
    expect(deepEqual({ [s]: undefined }, {}, { undefinedAsAbsent: true })).toBe(true);
  });

  it('holds across realms', () => {
    const value = { a: [1, { b: 2 }] };
    expect(deepEqual(structuredClone(value), value)).toBe(true);
    expect(deepEqual(runInNewContext('({ a: [1] })'), { a: [1] })).toBe(true);
    expect(deepEqual(Object.create(Object.create(null)), {})).toBe(false);
  });

  it('compares functions, class instances, dates and maps by identity', () => {
    const f = () => 1;
    expect(deepEqual({ f }, { f })).toBe(true);
    expect(deepEqual({ f }, { f: () => 1 })).toBe(false);
    class P { constructor(readonly x: number) {} }
    expect(deepEqual(new P(1), new P(1))).toBe(false);
    expect(deepEqual(new Date(0), new Date(0))).toBe(false);
  });

  it('compares an Array subclass instance only to itself, as any class instance', () => {
    class Path extends Array<number> {}
    const path = Path.from([1, 2]);
    expect(deepEqual(path, [1, 2])).toBe(false);
    expect(deepEqual(path, Path.from([1, 2]))).toBe(false);
    expect(deepEqual(path, path)).toBe(true);
  });

  it('counts a key holding undefined as present unless told otherwise', () => {
    expect(deepEqual({ a: 1, b: undefined }, { a: 1 })).toBe(false);
    expect(deepEqual({ a: 1, b: undefined }, { a: 1 }, { undefinedAsAbsent: true })).toBe(true);
    expect(deepEqual({ n: { b: undefined } }, { n: {} }, { undefinedAsAbsent: true })).toBe(true);
  });

  it('compares values that hold themselves by shape rather than overflow the stack', () => {
    const cycle = (n: number) => { const o: Record<string, unknown> = { n }; o.self = o; return o; };
    expect(deepEqual(cycle(1), cycle(1))).toBe(true);
    expect(deepEqual(cycle(1), cycle(2))).toBe(false);
    const list = (n: number) => { const l: unknown[] = [n]; l.push(l); return l; };
    expect(deepEqual(list(1), list(1))).toBe(true);
    expect(deepEqual(list(1), list(2))).toBe(false);
  });

  it('compares input nested far deeper than the call stack goes', () => {
    const deep = (n: number) => JSON.parse('['.repeat(n) + ']'.repeat(n)) as unknown;
    const object = (n: number) => { let o: unknown = 1; for (let i = 0; i < n; i++) o = { o }; return o; };
    expect(deepEqual(deep(1e5), deep(1e5))).toBe(true);
    expect(deepEqual(deep(1e5), deep(1e5 - 1))).toBe(false);
    expect(deepEqual(object(1e5), object(1e5), { undefinedAsAbsent: true })).toBe(true);
  });

  it('compares an array with no prototype only to itself, never to an object with its indices as keys', () => {
    const bare = Object.setPrototypeOf([1, 2], null) as unknown[];
    expect(deepEqual(bare, { 0: 1, 1: 2 })).toBe(false);
    expect(deepEqual({ 0: 1, 1: 2 }, bare)).toBe(false);
    expect(deepEqual(bare, [1, 2])).toBe(false);
    expect(deepEqual(bare, bare)).toBe(true);
  });

  it('reads a hole as undefined even where the prototype chain holds a value at that index', () => {
    const [holed, filled] = runInNewContext('Array.prototype[0] = "inherited"; [[, 1], [undefined, 1]]') as unknown[][];
    expect(deepEqual(holed, filled)).toBe(true);
  });
});
