/** Counterexamples the second pass's scale properties shrank to, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import { bandScale } from './band';
import { formatNumber, linearScale } from './linear';
import { logScale } from './log';
import { ordinalScale } from './ordinal';
import { formatTick, toFixedPlain } from './tickFormat';

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

  it('labels spaced ticks finer than 1e-100 apart, with an exponent', () => {
    const { values, step, decimals } = linearScale({ domain: [0, 3e-323], range: [0, 2] }).spacedTicks({ minSpacing: 1 });
    expect(values.map((v) => formatTick(v, { decimals, step }))).toEqual(['0', '2e-323']);
    expect(formatNumber(1.5e-300, 1e-300)).toBe('1.5e-300');
  });

  it('places a value between log ends whose logarithms round together by its distance, either way round', () => {
    // Three doubles apart, with the value two from the first.
    const [d0, d1] = [999999999.9999981, 999999999.9999977];
    const v = 999999999.9999979;
    expect(logScale({ domain: [d0, d1], range: [0, 1] }).map(v)).toBeCloseTo(2 / 3, 9);
    expect(logScale({ domain: [d1, d0], range: [1, 0] }).map(v)).toBeCloseTo(2 / 3, 9);
  });

  it('spaces ticks across a domain near the largest double on a finite step', () => {
    const { values, step } = linearScale({ domain: [0, -Number.MAX_VALUE], range: [1, 0] }).spacedTicks({ minSpacing: 1 });
    expect(step).toBe(Number.MAX_VALUE);
    expect(values).toEqual([-Number.MAX_VALUE, 0]);
  });

  it('spaces no tick past a domain far narrower than the step', () => {
    expect(linearScale({ domain: [-3715146.8331344076, -1], range: [-1463, -1464] }).spacedTicks({ minSpacing: 134.58421888600756 }).values)
      .toEqual([]);
  });

  it('spaces no ticks where the spacing\'s step in domain units is past the double range', () => {
    expect(linearScale({ domain: [1e308, 0], range: [0, 1] }).spacedTicks({ minSpacing: 1.797693134862316 }))
      .toEqual({ values: [], step: 0, decimals: 0 });
  });

  it('writes a tick to the places toFixed takes, rather than throwing past them', () => {
    expect(toFixedPlain(0, -1)).toBe('0');
    expect(formatTick(1, { decimals: 101, step: 0 })).toBe(`1.${'0'.repeat(100)}`);
  });
});
