/**
 * Metamorphic property tests of `deepEqual`: equality without `undefinedAsAbsent` implies it with; wrapping two
 * values alike, in an array or under one key of any realm's object, keeps the answer; adding a key holding
 * `undefined` keeps an equal pair equal under `undefinedAsAbsent`; and long arrays compare as their items do.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { deepEqual } from './deepEqual';
import { arrayOf, objectKey, objectOf, rebuild, runs, tally, timeoutFor, value, type Realm } from './pbt.fixture';

const RUNS = 400;
const realm = fc.constantFrom<Realm>('here', 'vm', 'null');
/** Two values, often equal: one and a copy of it, or two drawn apart. */
const pair = fc.oneof(
  fc.tuple(value, realm).map(([a, r]) => [a, rebuild(a, () => r)] as const),
  fc.tuple(value, value),
);

describe('deepEqual, metamorphic', () => {
  it('reads a pair equal under undefinedAsAbsent whenever it is equal without', () => {
    fc.assert(fc.property(pair, ([a, b]) => {
      if (deepEqual(a, b)) expect(deepEqual(a, b, { undefinedAsAbsent: true })).toBe(true);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));

  it('keeps its answer when both sides are wrapped alike', () => {
    const t = tally();
    fc.assert(fc.property(pair, objectKey, realm, realm, fc.boolean(), fc.boolean(), ([a, b], k, ra, rb, inArray, absent) => {
      const opts = { undefinedAsAbsent: absent };
      const wrap = (v: unknown, r: Realm) => (inArray ? arrayOf([v], r === 'null' ? 'here' : r) : objectOf([[k, v]], r));
      const want = deepEqual(a, b, opts);
      expect(deepEqual(wrap(a, ra), wrap(b, rb), opts)).toBe(want);
      t.count(want ? 'equal' : 'unequal');
    }), runs(RUNS));
    t.atLeast('equal', RUNS / 5);
    t.atLeast('unequal', RUNS / 5);
  }, timeoutFor(RUNS, 1));

  it('keeps an equal pair equal under undefinedAsAbsent when one side gains a key holding undefined', () => {
    fc.assert(fc.property(fc.uniqueArray(fc.tuple(objectKey, value), { maxLength: 3, selector: ([k]) => k }), objectKey, realm, realm,
      (pairs, extra, ra, rb) => {
        const a = objectOf(pairs, ra);
        const b = objectOf(pairs.some(([k]) => k === extra) ? pairs : [...pairs, [extra, undefined]], rb);
        expect(deepEqual(a, b, { undefinedAsAbsent: true })).toBe(true);
      }), runs(RUNS));
  }, timeoutFor(RUNS, 1));

  it('compares long arrays as their items compare', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 20_000 }), fc.option(fc.nat(), { nil: undefined }), (n, at) => {
      const a = Array.from({ length: n }, (_, i) => ({ i }));
      const b = Array.from({ length: n }, (_, i) => ({ i: at !== undefined && i === at % Math.max(1, n) ? -1 : i }));
      expect(deepEqual(a, b)).toBe(at === undefined || n === 0);
    }), runs(RUNS / 10));
  }, timeoutFor(RUNS, 5));
});
