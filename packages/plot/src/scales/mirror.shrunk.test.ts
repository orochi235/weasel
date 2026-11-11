/** Counterexamples the second pass's scale properties shrank to, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import { bandScale } from './band';
import { ordinalScale } from './ordinal';

describe('scales, shrunk (second pass)', () => {
  it('keeps a key the domain names twice at its first place, listed once', () => {
    const s = ordinalScale({ domain: ['a', 'a', 'b'], range: [0, 1, 2] });
    expect(s.ticks()).toEqual(['a', 'b']);
    expect(s.map('a')).toBe(0);
    expect(s.map('b')).toBe(1);
    const b = bandScale({ domain: ['a', 'a'], range: [0, 100], paddingInner: 0, paddingOuter: 0 });
    expect(b.domain).toEqual(['a']);
    expect(b.bandwidth).toBe(100);
  });

  it('lays bands with the default padding where a padding is not a number', () => {
    const plain = bandScale({ domain: ['a', 'b'], range: [0, 100] });
    for (const [paddingInner, paddingOuter] of [[undefined, Number.NaN], [Number.NaN, undefined], [undefined, Infinity]]) {
      const s = bandScale({ domain: ['a', 'b'], range: [0, 100], paddingInner, paddingOuter });
      expect([s.start('a'), s.start('b'), s.bandwidth]).toEqual([plain.start('a'), plain.start('b'), plain.bandwidth]);
    }
  });
});
