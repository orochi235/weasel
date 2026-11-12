/**
 * Property test of the timeline's window fractions: where the lane and ruler place a time and a duration agrees
 * with the pixel scale. The window math itself is `@weasel-js/ui-input`'s span, tested there.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, timeoutFor, uniform } from '../../pbt.fixture';
import { spanFraction, toFraction, windowScale, type TimeWindow } from './timeScale';

const RUNS = 500;

const ms = fc.oneof(fc.integer({ min: -100_000, max: 100_000 }), fc.double({ min: -1e6, max: 1e6, noNaN: true }));
const window = fc.tuple(ms, fc.oneof(uniform(0.001, 1e6), fc.integer({ min: 1, max: 100_000 })))
  .map(([from, span]): TimeWindow => ({ from, to: from + span }));

describe('window fractions', () => {
  it('place a time and a duration as the pixel scale does', () => {
    fc.assert(fc.property(window, ms, fc.integer({ min: 1, max: 4000 }), (w, at, width) => {
      const scale = windowScale(w, width);
      expect(toFraction(w, w.from)).toBe(0);
      expect(toFraction(w, w.to)).toBeCloseTo(1, 9);
      expect(toFraction(w, at) * width).toBeCloseTo(scale.map(at), Math.max(0, 4 - Math.log10(1 + Math.abs(scale.map(at)))));
      expect(spanFraction(w, at - w.from)).toBeCloseTo(toFraction(w, at), 9);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});
