import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  TYPED_ARRAY_CONSTRUCTORS, reviveTypedArrays, tagTypedArrays, typedArrayReplacer, type TypedArrayTag,
} from './typedArrayJson';
import { runs } from './pbt.fixture';

const RUNS = runs(300);
const TAGS = Object.keys(TYPED_ARRAY_CONSTRUCTORS) as TypedArrayTag[];

/** Any number, the ones JSON cannot write included. */
const anyNumber = fc.oneof(fc.double(), fc.constantFrom(Number.NaN, Infinity, -Infinity, -0, 0));
const typedArray = fc.tuple(fc.constantFrom(...TAGS), fc.array(anyNumber, { maxLength: 6 }))
  .map(([tag, data]) => TYPED_ARRAY_CONSTRUCTORS[tag].from(data));
/** Plain values shaped like what the encoding writes: a tagged array, or a wrapper. */
const lookalike = fc.oneof(
  fc.record({ __ta: fc.constantFrom(...TAGS), data: fc.array(fc.integer({ min: 0, max: 100 }), { maxLength: 3 }) }),
  fc.record({ __raw: fc.oneof(fc.integer(), fc.constant(null), fc.record({ __ta: fc.constant('u8'), data: fc.constant([1]) })) }),
);
const key = fc.oneof(fc.string({ maxLength: 4 }), fc.constantFrom('__ta', 'data', '__raw', '__proto__', 'constructor'));
const leaf = fc.oneof(fc.string({ maxLength: 4 }), fc.integer(), fc.boolean(), fc.constant(null), typedArray, lookalike);
const { value } = fc.letrec<{ value: unknown }>((tie) => ({
  value: fc.oneof({ depthSize: 'small', withCrossShrink: true }, leaf,
    fc.array(tie('value'), { maxLength: 4 }),
    fc.array(fc.tuple(key, tie('value')), { maxLength: 4 }).map((entries) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of entries) Object.defineProperty(out, k, { value: v, enumerable: true, writable: true, configurable: true });
      return out;
    })),
}));

/** `a` and `b` alike, typed arrays' classes and `NaN` and `-0` entries included, and own keys in order. */
function same(a: unknown, b: unknown): boolean {
  if (ArrayBuffer.isView(a) || ArrayBuffer.isView(b)) {
    const tag = (v: unknown) => Object.prototype.toString.call(v);
    if (tag(a) !== tag(b)) return false;
    const x = Array.from(a as Float64Array), y = Array.from(b as Float64Array);
    return x.length === y.length && x.every((n, i) => Object.is(n, y[i]));
  }
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((v, i) => same(v, b[i]));
  if (a !== null && typeof a === 'object') {
    if (b === null || typeof b !== 'object' || Array.isArray(b)) return false;
    const ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k, i) => k === kb[i]
      && same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return Object.is(a, b);
}

describe('typed arrays through JSON, property', () => {
  it('come back as they went, whatever holds them and whatever else is there', () => {
    const tally = { lookalikes: 0 };
    fc.assert(fc.property(value, (v) => {
      const text = JSON.stringify(tagTypedArrays(v));
      if (text?.includes('"__')) tally.lookalikes++;
      if (text === undefined) return;
      expect(same(reviveTypedArrays(JSON.parse(text)), v)).toBe(true);
      expect(JSON.stringify(v, typedArrayReplacer)).toBe(text);
    }), RUNS);
    expect(tally.lookalikes).toBeGreaterThan(RUNS.numRuns / 4);
  });

  it('write what the first version of the encoding wrote, wherever that could hold the value, and read its files', () => {
    // The writer as it stood on 2026-10-12 (126116b48): a tag and `Array.from` of the numbers, nothing escaped.
    const first = (v: unknown): unknown => {
      if (ArrayBuffer.isView(v)) {
        const tag = TAGS.find((t) => Object.prototype.toString.call(v) === `[object ${TYPED_ARRAY_CONSTRUCTORS[t].name}]`)!;
        return { __ta: tag, data: Array.from(v as Float64Array) };
      }
      if (Array.isArray(v)) return v.map(first);
      if (v === null || typeof v !== 'object') return v;
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, first(x)]));
    };
    const plainNumber = fc.double({ noNaN: true, noDefaultInfinity: true }).filter((n) => !Object.is(n, -0));
    const finiteArray = fc.tuple(fc.constantFrom(...TAGS), fc.array(plainNumber, { maxLength: 6 }))
      .map(([tag, data]) => TYPED_ARRAY_CONSTRUCTORS[tag].from(data))
      .filter((a) => Array.from(a as Float64Array).every((n) => Number.isFinite(n) && !Object.is(n, -0)));
    const saved = fc.dictionary(fc.string({ maxLength: 4 }).filter((k) => !k.startsWith('__') && k !== 'constructor'),
      fc.oneof(finiteArray, fc.array(finiteArray, { maxLength: 3 }), fc.integer(), fc.string({ maxLength: 4 })), { maxKeys: 5 });
    fc.assert(fc.property(saved, (v) => {
      const old = JSON.stringify(first(v));
      expect(JSON.stringify(tagTypedArrays(v))).toBe(old);
      expect(same(reviveTypedArrays(JSON.parse(old)), v)).toBe(true);
    }), RUNS);
  });
});
