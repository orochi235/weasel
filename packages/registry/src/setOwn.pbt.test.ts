/**
 * Property test of `setOwn` over runs of writes to plain objects of any realm, keys named like `Object.prototype`
 * members included: each write leaves the key own, enumerable, and holding the value, the prototype and every
 * other key as they were, and the keys in the order each was first written
 * (integer-like keys first, as on any object).
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { setOwn } from './setOwn';
import { objectKey, objectOf, runs, timeoutFor, type Realm } from './pbt.fixture';

const RUNS = 300;

describe('setOwn', () => {
  it('writes own keys in order, prototype and other keys untouched, whatever the key is named', () => {
    const writes = fc.array(fc.tuple(objectKey, fc.oneof(fc.integer(), fc.constant(undefined), fc.constant(null), fc.constant({}))), { maxLength: 12 });
    fc.assert(fc.property(writes, fc.constantFrom<Realm>('here', 'vm', 'null'), (ws, realm) => {
      const o = objectOf([], realm);
      const proto = Object.getPrototypeOf(o) as object | null;
      const model = new Map<string, unknown>();
      for (const [k, v] of ws) {
        setOwn(o, k, v);
        model.set(k, v);
        expect(Object.getPrototypeOf(o)).toBe(proto);
        // Integer-like keys list first, as on any object.
        expect(Object.keys(o)).toEqual(Object.keys(objectOf([...model], 'null')));
        for (const [mk, mv] of model) {
          expect(Object.getOwnPropertyDescriptor(o, mk)).toEqual({ value: mv, writable: true, enumerable: true, configurable: true });
        }
      }
      if (proto !== null) expect(Object.keys(proto)).toEqual([]);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});
