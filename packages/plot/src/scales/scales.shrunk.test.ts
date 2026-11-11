/** Counterexamples the scales' property tests shrank to, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import { linearScale } from './linear';
import { logScale } from './log';
import { formatInstant, timeScale } from './time';
import { powScale } from './warp';

const MAX = Number.MAX_VALUE;

describe('scales, shrunk', () => {
  it('places a value whose distance from the domain\'s start is past the double range', () => {
    const s = linearScale({ domain: [-MAX, 0], range: [100, 10] });
    expect(s.map(9.9792015476736e291)).toBeCloseTo(10, 9);
    const wide = linearScale({ domain: [-MAX, MAX], range: [0, 100] });
    expect(wide.map(0)).toBe(50);
    expect(wide.invert(50)).toBe(0);
    expect(powScale({ domain: [-MAX, MAX], range: [0, 100], exponent: 1 }).map(0)).toBe(50);
    expect(timeScale({ domain: [-MAX, MAX], range: [0, 100] }).map(0)).toBe(50);
  });

  it('inverts the range\'s ends to the domain\'s exactly, near the double range\'s end', () => {
    const s = linearScale({ domain: [1e308, -MAX], range: [0, -1] });
    expect(s.invert(-1)).toBe(-MAX);
    expect(s.invert(0)).toBe(1e308);
  });

  it('ticks a span near the largest double with a finite step', () => {
    const s = linearScale({ domain: [0, -MAX], range: [0, 1] });
    expect(s.tickStep(1)).toBe(1e308);
    expect(s.ticks(1)).toEqual([0, -1e308]);
  });

  it('ticks and labels a span finer than 1e-100 apart', () => {
    const s = linearScale({ domain: [1.0000000000000002e-300, 0], range: [0, 1] });
    const ticks = s.ticks(1);
    expect(ticks).toEqual([1e-300, 0]);
    expect(ticks.map(s.tickFormat(1))).toEqual(['1e-300', '0']);
    const log = logScale({ domain: [1e-300, 1e-200], range: [0, 1] });
    const labels = log.ticks().map(log.tickFormat());
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels[0]).toBe('1e-300');
  });

  it('sends a log domain\'s ends to the range\'s ends when their logarithms round together', () => {
    const s = logScale({ domain: [1e-12, 1.0000000000000002e-12], range: [0, 1], base: 2 });
    expect(s.map(1e-12)).toBe(0);
    expect(s.map(1.0000000000000002e-12)).toBe(1);
    const tiny = logScale({ domain: [1.0000000000000002e-300, 1.0000000000000004e-300], range: [0, 1] });
    expect(tiny.ticks()).toEqual([]);
  });

  it('inverts a log scale\'s ends without overflowing', () => {
    expect(logScale({ domain: [MAX, 5e-324], range: [0, -1], base: 2 }).invert(0)).toBe(MAX);
  });

  it('thins a log axis of many decades to about the count asked for', () => {
    const s = logScale({ domain: [5e-324, MAX], range: [0, 1] });
    expect(s.ticks(5).length).toBeLessThanOrEqual(11);
    expect(logScale({ domain: [5e-324, 1e-12], range: [0, 1], base: 1.1 }).ticks(5).length).toBeLessThanOrEqual(11);
  });

  it('labels small powers of another base apart', () => {
    const s = logScale({ domain: [1e-12, 1.1992415702456948e-12], range: [0, 1], base: 1.1000000000000008 });
    const labels = s.ticks().map(s.tickFormat());
    expect(labels).toHaveLength(2);
    expect(new Set(labels).size).toBe(2);
  });

  it('writes a month in a year past 9999 whole', () => {
    expect(formatInstant(Date.parse('+010000-02-01T00:00:00Z'), 'month')).toBe('10000-02');
    const s = timeScale({ domain: [253252548416649, 253252548416649 + 157614783351], range: [0, 1] });
    const labels = s.ticks(11).map(s.tickFormat(11));
    for (let i = 1; i < labels.length; i++) expect(labels[i]).not.toBe(labels[i - 1]);
  });
});
