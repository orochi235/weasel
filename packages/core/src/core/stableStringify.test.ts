import { describe, expect, it } from 'vitest';
import { stableStringify } from './stableStringify';

describe('stableStringify', () => {
  it('writes equal objects with differently ordered keys as one string', () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: [3, { f: 4, e: 5 }] } })).toBe(
      stableStringify({ a: { c: [3, { e: 5, f: 4 }], d: 2 }, b: 1 }),
    );
  });

  it('keeps array order', () => {
    expect(stableStringify([2, 1])).not.toBe(stableStringify([1, 2]));
  });

  it('writes what JSON writes for dates, undefined and functions', () => {
    const value = { d: new Date(0), u: undefined, f: () => 1, list: [undefined, 1] };
    expect(stableStringify(value)).toBe(JSON.stringify({ d: new Date(0), list: [undefined, 1] }));
  });

  it('tells NaN, each infinity, and null apart', () => {
    const written = [NaN, Infinity, -Infinity, null].map((v) => stableStringify({ a: v }));
    expect(new Set(written).size).toBe(4);
    expect(written[0]).toBe('{"a":{"$type":"number","value":"NaN"}}');
  });

  it('writes a value JSON writes nothing for as a string no JSON reads as', () => {
    for (const v of [undefined, () => 1, Symbol('s'), { toJSON: () => undefined }]) {
      expect(stableStringify(v)).toBe('undefined');
    }
  });

  it('writes a bigint as a marker instead of throwing, and tells two apart', () => {
    expect(stableStringify({ n: 10n })).toBe('{"n":{"$type":"bigint","value":"10"}}');
    expect(stableStringify(10n)).not.toBe(stableStringify(11n));
  });

  it('never writes a real object as a tag', () => {
    expect(stableStringify({ $type: 'bigint', value: '10' })).not.toBe(stableStringify(10n));
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    expect(stableStringify({ self: { $type: 'cycle' } })).not.toBe(stableStringify(loop));
    const wrapped = { $type: 'object', value: { a: 1 } };
    expect(stableStringify(wrapped)).not.toBe(stableStringify({ a: 1 }));
    expect(stableStringify({ $type: 'object', value: wrapped })).not.toBe(stableStringify(wrapped));
  });

  it('writes a cycle as a marker instead of throwing, and a shared reference out twice', () => {
    const shared = { v: 1 };
    const loop: Record<string, unknown> = { shared, again: shared };
    loop.self = loop;
    expect(stableStringify(loop)).toBe('{"again":{"v":1},"self":{"$type":"cycle"},"shared":{"v":1}}');
  });
});
