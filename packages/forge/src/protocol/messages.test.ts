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

});
