/**
 * Property tests of `deepEqual`: it agrees with a canonical spelling of each value (keys sorted, `-0` and `NaN`
 * as `Object.is` reads them, a hole as `undefined`), whatever realm built each object; it is reflexive and
 * symmetric; and `undefinedAsAbsent` reads a key holding `undefined` as absent, keys named like
 * `Object.prototype` members included.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { deepEqual } from './deepEqual';
import { objectOf, rebuild, runs, tally, timeoutFor, value, type Realm } from './pbt.fixture';

const RUNS = 400;

/** `v` spelled so two values deepEqual calls equal spell alike. */
function canon(v: unknown, absent: boolean): string {
  if (Array.isArray(v)) return `[${Array.from(v, (x) => canon(x, absent)).join(',')}]`;
  if (typeof v === 'object' && v !== null) {
    const rec = v as Record<string, unknown>;
    const keys = Object.keys(rec).filter((k) => !absent || rec[k] !== undefined).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canon(rec[k], absent)}`).join(',')}}`;
  }
  if (typeof v === 'number') return Object.is(v, -0) ? '-0' : String(v);
  return v === undefined ? 'u' : JSON.stringify(v);
}

const realms = fc.array(fc.constantFrom<Realm>('here', 'vm', 'null'), { minLength: 1, maxLength: 8 });
const picker = (rs: readonly Realm[]) => { let i = 0; return () => rs[i++ % rs.length]!; };

/** Two values that are often equal: one and a rebuilt copy, one and a copy changed at one leaf, or two drawn apart. */
const pair = fc.oneof(
  fc.tuple(value, realms).map(([a, rs]) => [a, rebuild(a, picker(rs))] as const),
  fc.tuple(value, value),
  fc.tuple(value, value, realms).map(([a, b, rs]) => [objectOf([['k', a]], 'here'), objectOf([['k', rebuild(b, picker(rs))]], rs[0]!)] as const),
);

describe('deepEqual', () => {
  it('agrees with the canonical spelling, with and without undefinedAsAbsent', () => {
    const t = tally();
    fc.assert(fc.property(pair, fc.boolean(), ([a, b], absent) => {
      const want = canon(a, absent) === canon(b, absent);
      expect(deepEqual(a, b, { undefinedAsAbsent: absent })).toBe(want);
      t.count(want ? 'equal' : 'unequal');
      if (want && typeof a === 'object' && a !== null && a !== b) t.count('equal objects');
    }), runs(RUNS));
    t.atLeast('equal', RUNS / 10);
    t.atLeast('equal objects', RUNS / 20);
    t.atLeast('unequal', RUNS / 5);
  }, timeoutFor(RUNS, 2));

  it('is reflexive, on a value and on any rebuilt copy of it', () => {
    fc.assert(fc.property(value, realms, fc.boolean(), (v, rs, absent) => {
      expect(deepEqual(v, v, { undefinedAsAbsent: absent })).toBe(true);
      expect(deepEqual(v, rebuild(v, picker(rs)), { undefinedAsAbsent: absent })).toBe(true);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 2));

  it('is symmetric', () => {
    fc.assert(fc.property(pair, fc.boolean(), ([a, b], absent) => {
      expect(deepEqual(a, b, { undefinedAsAbsent: absent })).toBe(deepEqual(b, a, { undefinedAsAbsent: absent }));
    }), runs(RUNS));
  }, timeoutFor(RUNS, 2));

  it('compares JSON values as their JSON text does once keys are sorted', () => {
    const sorted = (v: unknown): unknown => (Array.isArray(v) ? v.map(sorted)
      : typeof v === 'object' && v !== null ? objectOf(Object.keys(v).sort().map((k) => [k, sorted((v as Record<string, unknown>)[k])]), 'here') : v);
    const json = fc.jsonValue({ maxDepth: 3 }).map((v) => JSON.parse(JSON.stringify(v)) as unknown);
    const t = tally();
    fc.assert(fc.property(fc.oneof(fc.tuple(json, json), json.map((v) => [v, JSON.parse(JSON.stringify(v))] as const)), ([a, b]) => {
      const want = JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
      expect(deepEqual(a, b)).toBe(want);
      t.count(want ? 'equal' : 'unequal');
    }), runs(RUNS));
    t.atLeast('equal', RUNS / 10);
    t.atLeast('unequal', RUNS / 5);
  }, timeoutFor(RUNS, 2));
});

describe('deepEqual, shrunk', () => {
  it('reads a hole as undefined, never as whatever the other side holds', () => {
    expect(deepEqual([, 1], [5, 1])).toBe(false);
    expect(deepEqual([, 1], [undefined, 1])).toBe(true);
  });

  it('reads an absent key named like an Object.prototype member as undefined under undefinedAsAbsent', () => {
    expect(deepEqual(JSON.parse('{"__proto__":{}}'), {}, { undefinedAsAbsent: true })).toBe(false);
    expect(deepEqual({ constructor: undefined }, {}, { undefinedAsAbsent: true })).toBe(true);
  });
});
