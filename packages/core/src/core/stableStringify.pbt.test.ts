/**
 * Property tests for `stableStringify`: for anything `JSON.stringify` writes, it writes the same JSON with every
 * object's keys sorted, so key order never matters; what JSON throws on it writes as a tag instead.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, tally, timeoutFor } from './pbt.fixture';
import { stableStringify } from './stableStringify';

const N = 300;
const T = timeoutFor(N, 2);

/** JSON text of plain data, keys sorted: the answer `stableStringify` should give for anything JSON reads back so. */
function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical);
  if (v === null || typeof v !== 'object') return v;
  return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical((v as Record<string, unknown>)[k])]));
}
const oracle = (v: unknown): string | undefined => {
  const text = JSON.stringify(v);
  return text === undefined ? undefined : JSON.stringify(canonical(JSON.parse(text)));
};

/** An own data property, even for `__proto__`. */
function own(entries: readonly (readonly [string, unknown])[]): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const [k, v] of entries) Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true });
  return o;
}

const key = fc.oneof(fc.string({ maxLength: 4 }), fc.constantFrom('__proto__', 'constructor', 'toString', 'hasOwnProperty', '10', '2', '-1', ''));

/** Values JSON writes, built out of what it writes specially: dates, boxed primitives, `toJSON`, and members it drops. */
const exotic: fc.Arbitrary<unknown> = fc.letrec((tie) => ({
  value: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    fc.oneof(fc.integer(), fc.double(), fc.string({ maxLength: 4 }), fc.boolean(), fc.constant(null)),
    fc.constantFrom(undefined, () => 1, Symbol('s')),
    fc.integer({ min: -1e12, max: 1e12 }).map((t) => new Date(t)),
    fc.oneof(fc.integer().map((n) => Object(n)), fc.string({ maxLength: 3 }).map((s) => Object(s)), fc.boolean().map((b) => Object(b))),
    tie('value').map((inner) => ({ toJSON: () => inner })),
    tie('value').map((inner) => ({ toJSON: () => ({ toJSON: () => 'inner', v: inner }) })),
    fc.constant(null).map(() => { const self = { a: 1, toJSON() { return self; } }; return self; }),
    fc.array(tie('value'), { maxLength: 4 }),
    fc.array(fc.tuple(key, tie('value')), { maxLength: 4 }).map(own),
  ),
})).value;

describe('stableStringify', () => {
  it('writes what JSON.stringify writes, with every object\'s keys sorted', () => {
    fc.assert(fc.property(exotic, (v) => {
      expect(stableStringify(v)).toBe(oracle(v));
    }), runs(N));
  }, T);

  it('key order never changes the string, and a prototype-named key is a plain one', () => {
    const t = tally();
    const data = fc.letrec((tie) => ({
      value: fc.oneof(
        { depthSize: 'small' },
        fc.oneof(fc.integer(), fc.string({ maxLength: 4 }), fc.boolean(), fc.constant(null)),
        fc.array(tie('value'), { maxLength: 4 }),
        fc.uniqueArray(fc.tuple(key, tie('value')), { maxLength: 5, selector: ([k]) => k }),
      ),
    })).value;
    const build = (v: unknown, flip: boolean): unknown => {
      if (!Array.isArray(v)) return v;
      if (v.length > 0 && Array.isArray(v[0]) && v.every((e) => Array.isArray(e) && e.length === 2 && typeof e[0] === 'string')) {
        const entries = (v as [string, unknown][]).map(([k, x]) => [k, build(x, flip)] as const);
        return own(flip ? [...entries].reverse() : entries);
      }
      return v.map((x) => build(x, flip));
    };
    fc.assert(fc.property(data, (raw) => {
      const a = build(raw, false);
      const b = build(raw, true);
      const text = stableStringify(a);
      expect(stableStringify(b)).toBe(text);
      expect(JSON.parse(text!)).toEqual(JSON.parse(JSON.stringify(a)));
      if (/"__proto__"|"constructor"|"toString"/.test(text ?? '')) t.count('prototype key');
    }), runs(N));
    t.atLeast('prototype key', N / 10);
  }, T);

  it('never throws on a bigint or a cycle, and tells different bigints apart', () => {
    fc.assert(fc.property(fc.bigInt(), fc.bigInt(), fc.array(fc.nat({ max: 3 }), { minLength: 1, maxLength: 4 }), (a, b, path) => {
      expect(stableStringify({ n: a }) === stableStringify({ n: b })).toBe(a === b);
      const root: Record<string, unknown> = { n: a };
      let at = root;
      for (const k of path) { const next: Record<string, unknown> = {}; at[`k${k}`] = next; at = next; }
      at.back = root;
      const text = stableStringify(root);
      expect(text).toContain('{"$type":"cycle"}');
      expect(() => JSON.parse(text!)).not.toThrow();
    }), runs(N));
  }, T);
});
