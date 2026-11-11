/** Counterexamples the `stableStringify` property tests shrank to, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import { stableStringify } from './stableStringify';

describe('stableStringify, shrunk counterexamples', () => {
  it('writes a boxed primitive as its value', () => {
    expect(stableStringify([new Boolean(false)])).toBe('[false]');
    expect(stableStringify({ n: Object(3), s: Object('x') })).toBe('{"n":3,"s":"x"}');
  });

  it('calls a toJSON once, not again on what it returns', () => {
    expect(stableStringify({ toJSON: () => ({ toJSON: () => 'inner', v: 0 }) })).toBe('{"v":0}');
    const self = { a: 1, toJSON() { return self; } };
    expect(stableStringify(self)).toBe('{"a":1}');
    expect(stableStringify({ k: { toJSON: (key: string) => key } })).toBe('{"k":"k"}');
  });
});
