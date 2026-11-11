/**
 * Property tests of `isPlainObject` and `isPlainPrototype`: true for a literal or a null-prototype object from any
 * realm (this one, a VM context, `structuredClone`'s), whatever keys it holds; false for arrays, class instances,
 * built-ins, and objects whose prototype is anything else, a bare null-prototype object included.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runInNewContext } from 'node:vm';
import { isPlainObject, isPlainPrototype } from './isPlainObject';
import { objectKey, objectOf, runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 300;

class Point { x = 1; }

/** A value and whether it is plain, by how it was made. */
const made: fc.Arbitrary<readonly [string, () => unknown, boolean]> = fc.constantFrom(
  ['literal', () => ({}), true],
  ['null prototype', () => Object.create(null), true],
  ['vm literal', () => runInNewContext('({})'), true],
  ['vm null prototype', () => runInNewContext('Object.create(null)'), true],
  ['structuredClone', () => structuredClone({ a: 1 }), true],
  ['JSON.parse', () => JSON.parse('{"__proto__": 1, "constructor": 2}'), true],
  ['toStringTag', () => ({ [Symbol.toStringTag]: 'Odd' }), true],
  ['array', () => [], false],
  ['vm array', () => runInNewContext('[]'), false],
  ['class instance', () => new Point(), false],
  ['vm class instance', () => runInNewContext('new (class P {})()'), false],
  ['Date', () => new Date(0), false],
  ['vm Map', () => runInNewContext('new Map()'), false],
  ['over a literal', () => Object.create({}), false],
  ['over a vm literal', () => Object.create(runInNewContext('({})')), false],
  ['over a bare null-prototype object', () => Object.create(Object.create(null)), false],
  ['function', () => () => 1, false],
  ['null', () => null, false],
  ['string', () => 'x', false],
  ['number', () => 1, false],
);

describe('isPlainObject', () => {
  it('is true exactly for a literal or a null-prototype object, from any realm, whatever keys it holds', () => {
    const t = tally();
    fc.assert(fc.property(made, fc.array(objectKey, { maxLength: 3 }), ([what, make, plain], keys) => {
      const v = make();
      if (typeof v === 'object' && v !== null) for (const k of keys) Object.defineProperty(v, k, { value: 0, enumerable: true, configurable: true, writable: true });
      expect(isPlainObject(v), what).toBe(plain);
      t.count(plain ? 'plain' : 'not');
    }), runs(RUNS));
    t.atLeast('plain', RUNS / 8);
    t.atLeast('not', RUNS / 4);
  }, timeoutFor(RUNS, 2));

  it('reads every realm\'s Object.prototype, and null, as a plain prototype', () => {
    fc.assert(fc.property(fc.constantFrom('here', 'vm', 'null'), (where) => {
      const proto = where === 'here' ? Object.prototype : where === 'vm' ? runInNewContext('Object.prototype') as object : null;
      expect(isPlainPrototype(proto)).toBe(true);
      expect(isPlainObject(objectOf([['a', 1]], where === 'null' ? 'null' : where === 'vm' ? 'vm' : 'here'))).toBe(true);
    }), runs(RUNS / 10));
  }, timeoutFor(RUNS, 2));
});
