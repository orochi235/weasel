import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { axesOf } from './axes';
import { runs, tally } from '../pbt.fixture';

const RUNS = runs(400);

const n = fc.double({ min: -1e9, max: 1e9, noNaN: true });
const key = fc.oneof(fc.constantFrom('x', 'y', 'z', 'w', 'rotation', 'constructor', 'toString', '__proto__', '0', '10', '2'), fc.string({ maxLength: 4 }));
/** A number, an array of numbers, or a plain object of numbers, as JSON or code would build it. */
const sample = fc.oneof(
  n,
  fc.array(n, { maxLength: 6 }),
  fc.uniqueArray(fc.tuple(key, n), { minLength: 1, maxLength: 7, selector: ([k]) => k })
    .map((es) => JSON.parse(JSON.stringify(Object.fromEntries(es.map(([k, v]) => [k, v === 0 ? 0 : v])))) as Record<string, number>),
);

describe('axesOf, property', () => {
  it('reads a value back through its axes, and adds and writes as `to` does', () => {
    const t = tally();
    fc.assert(fc.property(sample, fc.array(n, { minLength: 8, maxLength: 8 }), fc.integer({ min: 0, max: 3 }), (v, d, at) => {
      const axes = axesOf(v);
      expect(axes).not.toBeNull();
      const a = axes!.to(v);
      expect(a.length).toBe(axes!.count);
      expect(axes!.from(a)).toEqual(v);
      const out = new Array<number>(at + a.length).fill(Number.NaN);
      axes!.write(v, out, at);
      expect(out.slice(at)).toEqual(a);
      expect(axes!.from(out, at)).toEqual(v);
      expect(axes!.to(axes!.add(v, d))).toEqual(a.map((x, i) => x + d[i]!));
      expect(axesOf(axes!.from(a))!.shape).toBe(axes!.shape);
      if (typeof v === 'object' && !Array.isArray(v)) t.count(Object.keys(v).length > 4 ? 'wide object' : 'object');
    }), RUNS);
    t.atLeast('object', 30);
    t.atLeast('wide object', 10);
  });

  it('gives two objects one shape exactly when they have the same fields', () => {
    const obj = fc.uniqueArray(fc.constantFrom('a', 'b', 'c', 'd', 'e'), { minLength: 1 }).map((ks) => Object.fromEntries(ks.map((k) => [k, 1])));
    fc.assert(fc.property(obj, obj, (p, q) => {
      const same = Object.keys(p).sort().join() === Object.keys(q).sort().join();
      expect(axesOf(p)!.shape === axesOf(q)!.shape).toBe(same);
    }), RUNS);
  });
});
