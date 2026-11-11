/**
 * Property tests of how a slider stacks readouts that would collide: no two on one row come within the gap of each
 * other, and each takes the first row, counted from the top, where it clears those placed before it.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, tally, timeoutFor } from '../../pbt.fixture';
import { staggerRows } from './staggerRows';

const RUNS = 400;
const span = fc.tuple(fc.integer({ min: -100, max: 300 }), fc.integer({ min: 0, max: 80 })).map(([start, w]) => ({ start, end: start + w }));

describe('staggerRows', () => {
  it('keeps every two readouts on one row a gap apart, each on the first row that clears it', () => {
    const t = tally();
    fc.assert(fc.property(fc.array(span, { maxLength: 8 }), fc.nat({ max: 8 }), (spans, gap) => {
      const rows = staggerRows(spans, gap);
      expect(rows).toHaveLength(spans.length);
      const clear = (a: { start: number; end: number }, b: { start: number; end: number }) => b.start >= a.end + gap || a.start >= b.end + gap;
      for (let i = 0; i < spans.length; i++) {
        for (let j = i + 1; j < spans.length; j++) {
          if (rows[i] === rows[j]) expect(clear(spans[i]!, spans[j]!)).toBe(true);
        }
      }
      // Placed in order of start: a readout lower than row 0 collides, on each row above it, with one placed earlier.
      const order = spans.map((_, i) => i).sort((a, b) => spans[a]!.start - spans[b]!.start);
      order.forEach((i, k) => {
        const earlier = order.slice(0, k);
        for (let r = 0; r < rows[i]!; r++) {
          const last = earlier.filter((j) => rows[j] === r).at(-1);
          expect(last === undefined || spans[i]!.start < spans[last]!.end + gap).toBe(true);
        }
      });
      if (rows.some((r) => r > 0)) t.count('stacked');
      if (rows.some((r) => r > 1)) t.count('three rows');
    }), runs(RUNS));
    t.atLeast('stacked', 100);
    t.atLeast('three rows', 30);
  }, timeoutFor(RUNS, 1));
});
