import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { isPortSafe, portSafePart, withUnsent } from './portSafe';

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

  it('rejects subclasses of the built-ins, which a clone turns back into the base class', () => {
    class Registry extends Map {}
    class Stops extends Array {}
    const registry = new Registry();
    registry.set(1, 2);
    expect(isPortSafe(registry)).toBe(false);
    const stops = new Stops();
    stops.push(1);
    expect(isPortSafe(stops)).toBe(false);
  });

  it('rejects own properties a clone drops', () => {
    const hidden = { a: 1 };
    Object.defineProperty(hidden, 'b', { value: 2, enumerable: false });
    expect(isPortSafe(hidden)).toBe(false);
    expect(isPortSafe({ a: 1, [Symbol('s')]: 2 })).toBe(false);
    expect(isPortSafe(Object.assign([1], { [Symbol('s')]: 2 }))).toBe(false);
  });

  it('rejects a value whose walk throws instead of throwing', () => {
    const value = {
      get x() {
        throw new Error('boom');
      },
    };
    expect(isPortSafe(value)).toBe(false);
  });

  it('terminates on a cycle', () => {
    const a: Record<string, unknown> = { n: 1 };
    a.self = a;
    expect(isPortSafe(a)).toBe(true);
    a.fn = () => 1;
    expect(isPortSafe(a)).toBe(false);
  });
});

describe('portSafePart', () => {
  const cancel = () => {};

  it('keeps a port-safe value whole', () => {
    const value = { a: [1, { b: 'c' }] };
    expect(portSafePart(value)).toEqual({ value });
  });

  it('drops the fields of a plain object that cannot cross, recursively', () => {
    expect(portSafePart({ done: 1, cancel, nested: { n: 2, fn: cancel }, icon: createElement('b') })).toEqual({
      value: { done: 1, nested: { n: 2 } },
    });
  });

  it('holds null where an array member cannot cross, so positions survive', () => {
    expect(portSafePart([{ id: 'a', render: cancel }, cancel, 3])).toEqual({ value: [{ id: 'a' }, null, 3] });
  });

  it('has no part for a function, an element, a class instance, or an object with keys a clone drops', () => {
    expect(portSafePart(cancel)).toBeNull();
    expect(portSafePart(createElement('b'))).toBeNull();
    expect(portSafePart(new Color())).toBeNull();
    expect(portSafePart({ a: 1, [Symbol('s')]: cancel })).toBeNull();
    expect(portSafePart(new Map([['k', cancel]]))).toBeNull();
  });

  it('terminates on a cycle through an unsafe value', () => {
    const a: Record<string, unknown> = { n: 1, cancel };
    a.self = a;
    expect(portSafePart(a)).toEqual({ value: { n: 1 } });
  });
});

describe('withUnsent', () => {
  const cancel = () => {};
  const render = () => null;

  it('puts back the fields the part dropped, taking every sent field as sent', () => {
    const original = { done: 1, cancel, nested: { n: 2, fn: cancel } };
    expect(withUnsent({ done: 5, nested: { n: 9 } }, original)).toEqual({ done: 5, cancel, nested: { n: 9, fn: cancel } });
  });

  it('fills array placeholders and dropped fields of members from the original', () => {
    const original = [{ id: 'a', render }, cancel];
    const out = withUnsent([{ id: 'b' }, null, { id: 'new' }], original) as unknown[];
    expect(out).toEqual([{ id: 'b', render }, cancel, { id: 'new' }]);
    expect(out[1]).toBe(cancel);
  });

  it('leaves out a port-safe field the sent value no longer has', () => {
    expect(withUnsent({}, { done: 1, cancel })).toEqual({ cancel });
  });

  it('returns the sent value when the original was port-safe or the shapes differ', () => {
    expect(withUnsent({ a: 2 }, { a: 1 })).toEqual({ a: 2 });
    expect(withUnsent('text', { a: 1, cancel })).toBe('text');
    expect(withUnsent([1], { cancel })).toEqual([1]);
  });

  it('round-trips a part back to the original', () => {
    const original = { status: 'running', done: 0, failures: [{ index: 3 }], start: cancel, cancel };
    const part = portSafePart(original);
    expect(withUnsent(structuredClone(part?.value), original)).toEqual(original);
  });
});
