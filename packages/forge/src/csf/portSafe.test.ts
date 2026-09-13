import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { isPortSafe } from './portSafe';

class Color {
  r = 1;
  hex() {
    return '#010000';
  }
}

describe('isPortSafe', () => {
  it('accepts primitives and null', () => {
    for (const value of ['s', 0, Number.NaN, true, 1n, undefined, null]) expect(isPortSafe(value)).toBe(true);
  });

  it('accepts arrays and plain objects of safe members, including a null prototype', () => {
    expect(isPortSafe([1, 'a', [null]])).toBe(true);
    expect(isPortSafe({ a: 1, b: { c: [true] } })).toBe(true);
    expect(isPortSafe(Object.assign(Object.create(null), { a: 1 }))).toBe(true);
  });

  it('accepts the built-ins a port clones faithfully', () => {
    expect(isPortSafe(new Date(0))).toBe(true);
    expect(isPortSafe(/x/g)).toBe(true);
    expect(isPortSafe(new ArrayBuffer(4))).toBe(true);
    expect(isPortSafe(new Uint8Array(4))).toBe(true);
    expect(isPortSafe(new Map([['k', { v: 1 }]]))).toBe(true);
    expect(isPortSafe(new Set([1, [2]]))).toBe(true);
  });

  it('rejects functions, symbols, React elements and class instances', () => {
    expect(isPortSafe(() => 1)).toBe(false);
    expect(isPortSafe(Symbol('s'))).toBe(false);
    expect(isPortSafe(createElement('b'))).toBe(false);
    expect(isPortSafe(new Color())).toBe(false);
  });

  it('rejects an unsafe value anywhere inside a container', () => {
    expect(isPortSafe([new Color()])).toBe(false);
    expect(isPortSafe({ a: { b: () => 1 } })).toBe(false);
    expect(isPortSafe(new Map([['k', new Color()]]))).toBe(false);
    expect(isPortSafe(new Map([[new Color(), 1]]))).toBe(false);
    expect(isPortSafe(new Set([() => 1]))).toBe(false);
  });

  it('terminates on a cycle', () => {
    const a: Record<string, unknown> = { n: 1 };
    a.self = a;
    expect(isPortSafe(a)).toBe(true);
    a.fn = () => 1;
    expect(isPortSafe(a)).toBe(false);
  });
});
