import { describe, expect, it } from 'vitest';
import { configKey } from './messages';

describe('configKey', () => {
  it('writes the contents of a Map, a Set, a RegExp, a buffer, and a typed array', () => {
    const apart: [unknown, unknown][] = [
      [new Map([['a', 1]]), new Map([['a', 2]])],
      [new Set([1]), new Set([2])],
      [/a/, /b/],
      [new Uint8Array([1]).buffer, new Uint8Array([2]).buffer],
      [new Float32Array([1]), new Float32Array([2])],
      [new Float32Array([1]), new Int8Array([1])],
      [new Float32Array([1]), { 0: 1 }],
      [new DataView(new Uint8Array([1]).buffer), new DataView(new Uint8Array([2]).buffer)],
      [new Date(0), new Date(1)],
      [new Date(Number.NaN), null],
    ];
    for (const [a, b] of apart) expect(configKey({ m: a })).not.toBe(configKey({ m: b }));
    expect(configKey({ m: new Map([['a', 1]]) })).toBe(configKey({ m: new Map([['a', 1]]) }));
  });

  it('keeps an object with a `$type` key apart from a tag', () => {
    expect(configKey({ n: { $type: 'number', value: 'NaN' } })).not.toBe(configKey({ n: Number.NaN }));
    expect(configKey({ m: { $type: 'set', value: [1] } })).not.toBe(configKey({ m: new Set([1]) }));
  });

  it('keeps an `undefined` member of a list, a Map, or a Set apart from `null`', () => {
    expect(configKey({ items: [undefined] })).not.toBe(configKey({ items: [null] }));
    expect(configKey({ m: new Map([['a', undefined]]) })).not.toBe(configKey({ m: new Map([['a', null]]) }));
    expect(configKey({ s: new Set([undefined]) })).not.toBe(configKey({ s: new Set([null]) }));
    expect(configKey({ items: [undefined] })).toBe(configKey({ items: [undefined] }));
  });
});
