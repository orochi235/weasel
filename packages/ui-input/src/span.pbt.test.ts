/**
 * Property tests of a span held inside bounds: a zoom or a pan stays inside them, a zoom is no shorter than its
 * minimum where the bounds allow and keeps the anchor's place unless a bound pushes it, and a pan keeps the length.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, tally, timeoutFor, uniform } from './pbt.fixture';
import { spanPan, spanPlace, spanZoom, type Span } from './span';

const RUNS = 500;

const value = fc.oneof(fc.integer({ min: -100_000, max: 100_000 }), fc.double({ min: -1e6, max: 1e6, noNaN: true }));
const bounds = fc.tuple(value, fc.oneof(uniform(0.001, 1e6), fc.integer({ min: 1, max: 100_000 })))
  .map(([from, length]): Span => ({ from, to: from + length }));
/** A span inside `b`, sometimes the whole of it. */
const inside = (b: Span) => fc.oneof(
  fc.constant(b),
  fc.tuple(uniform(0, 1), uniform(0, 1)).map(([p, q]) => {
    const [lo, hi] = p < q ? [p, q] : [q, p];
    return { from: b.from + (b.to - b.from) * lo, to: b.from + (b.to - b.from) * hi };
  }),
);
const case_ = bounds.chain((b) => fc.tuple(fc.constant(b), inside(b)));
const factor = fc.oneof(uniform(0.01, 10), fc.constantFrom(0.5, 1, 2, 1e-9, 1e9));

const within = (s: Span, b: Span) => {
  expect(s.from).toBeGreaterThanOrEqual(b.from);
  expect(s.to).toBeLessThanOrEqual(b.to);
  expect(s.to).toBeGreaterThanOrEqual(s.from);
};

describe('spanZoom and spanPan', () => {
  it("zoom stays in bounds, no shorter than its minimum where the bounds are, and keeps the anchor's place", () => {
    const t = tally();
    fc.assert(fc.property(case_, factor, uniform(0, 1), fc.constantFrom(0, 1), ([b, s], f, place, minLength) => {
      const at = s.from + (s.to - s.from) * place;
      const z = spanZoom(s, at, f, b, minLength);
      within(z, b);
      const whole = b.to - b.from;
      const want = Math.min(whole, Math.max(minLength, (s.to - s.from) * f));
      expect(z.to - z.from).toBeCloseTo(want, Math.max(0, 6 - Math.log10(1 + whole)));
      const free = z.from > b.from + 1e-6 * whole && z.to < b.to - 1e-6 * whole;
      // A span a few ulps long has no place to compare.
      const measurable = z.to - z.from > 1e-6 * (1 + Math.abs(at));
      if (free && s.to > s.from && measurable) {
        t.count('anchored');
        expect(spanPlace(z, at)).toBeCloseTo(spanPlace(s, at), 6);
      }
      t.count(f < 1 ? 'in' : 'out');
    }), runs(RUNS));
    t.atLeast('anchored', 50);
    t.atLeast('in', 50);
    t.atLeast('out', 50);
  }, timeoutFor(RUNS, 1));

  it('pan keeps the length and stays in bounds, and a pan of nothing changes nothing', () => {
    const t = tally();
    fc.assert(fc.property(case_, value, ([b, s], by) => {
      const p = spanPan(s, by, b);
      within(p, b);
      expect(p.to - p.from).toBeCloseTo(s.to - s.from, Math.max(0, 6 - Math.log10(1 + Math.abs(b.from) + Math.abs(b.to))));
      const still = spanPan(s, 0, b);
      expect(still.from === s.from && still.to === s.to).toBe(true);
      if (p.from === b.from || p.to === b.to) t.count('pinned');
      else t.count('free');
    }), runs(RUNS));
    t.atLeast('pinned', 50);
    t.atLeast('free', 50);
  }, timeoutFor(RUNS, 1));
});
