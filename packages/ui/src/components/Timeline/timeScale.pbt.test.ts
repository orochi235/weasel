/**
 * Property tests of the timeline's window math: a zoom or a pan stays inside its bounds and never narrower than a
 * millisecond the bounds allow, a pan keeps the span, a zoom keeps the time under the pointer where it was unless a
 * bound pushes it, and the fractions the lane and ruler place by agree with the pixel scale.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, tally, timeoutFor, uniform } from '../../pbt.fixture';
import { panWindow, spanFraction, toFraction, windowScale, zoomWindow, type TimeWindow } from './timeScale';

const RUNS = 500;

const ms = fc.oneof(fc.integer({ min: -100_000, max: 100_000 }), fc.double({ min: -1e6, max: 1e6, noNaN: true }));
const bounds = fc.tuple(ms, fc.oneof(uniform(0.001, 1e6), fc.integer({ min: 1, max: 100_000 })))
  .map(([from, span]): TimeWindow => ({ from, to: from + span }));
/** A window inside `b`, sometimes the whole of it. */
const inside = (b: TimeWindow) => fc.oneof(
  fc.constant(b),
  fc.tuple(uniform(0, 1), uniform(0, 1)).map(([p, q]) => {
    const [lo, hi] = p < q ? [p, q] : [q, p];
    return { from: b.from + (b.to - b.from) * lo, to: b.from + (b.to - b.from) * hi };
  }),
);
const case_ = bounds.chain((b) => fc.tuple(fc.constant(b), inside(b)));
const factor = fc.oneof(uniform(0.01, 10), fc.constantFrom(0.5, 1, 2, 1e-9, 1e9));

const within = (w: TimeWindow, b: TimeWindow) => {
  expect(w.from).toBeGreaterThanOrEqual(b.from);
  expect(w.to).toBeLessThanOrEqual(b.to);
  expect(w.to).toBeGreaterThanOrEqual(w.from);
};

describe('zoomWindow and panWindow', () => {
  it('zoom stays in bounds, at least a millisecond wide where the bounds are, and keeps the pointer\'s time', () => {
    const t = tally();
    fc.assert(fc.property(case_, factor, uniform(0, 1), ([b, w], f, at) => {
      const atMs = w.from + (w.to - w.from) * at;
      const z = zoomWindow(w, atMs, f, b);
      within(z, b);
      const span = z.to - z.from;
      const bSpan = b.to - b.from;
      const want = Math.min(bSpan, Math.max(1, (w.to - w.from) * f));
      expect(span).toBeCloseTo(want, Math.max(0, 6 - Math.log10(1 + bSpan)));
      const free = z.from > b.from + 1e-6 * bSpan && z.to < b.to - 1e-6 * bSpan;
      if (free && w.to > w.from) {
        t.count('anchored');
        expect(toFraction(z, atMs)).toBeCloseTo(toFraction(w, atMs), 6);
      }
      t.count(f < 1 ? 'in' : 'out');
    }), runs(RUNS));
    t.atLeast('anchored', 50);
    t.atLeast('in', 50);
    t.atLeast('out', 50);
  }, timeoutFor(RUNS, 1));

  it('pan keeps the span and stays in bounds, and a pan of nothing changes nothing', () => {
    const t = tally();
    fc.assert(fc.property(case_, ms, ([b, w], by) => {
      const p = panWindow(w, by, b);
      within(p, b);
      expect(p.to - p.from).toBeCloseTo(w.to - w.from, Math.max(0, 6 - Math.log10(1 + Math.abs(b.from) + Math.abs(b.to))));
      expect(panWindow(w, 0, b)).toEqual(w);
      if (p.from === b.from || p.to === b.to) t.count('pinned');
      else t.count('free');
    }), runs(RUNS));
    t.atLeast('pinned', 50);
    t.atLeast('free', 50);
  }, timeoutFor(RUNS, 1));
});

describe('window fractions', () => {
  it('place a time and a duration as the pixel scale does', () => {
    fc.assert(fc.property(case_, ms, fc.integer({ min: 1, max: 4000 }), ([, w], at, width) => {
      fc.pre(w.to > w.from);
      const scale = windowScale(w, width);
      expect(toFraction(w, w.from)).toBe(0);
      expect(toFraction(w, w.to)).toBeCloseTo(1, 9);
      expect(toFraction(w, at) * width).toBeCloseTo(scale.map(at), Math.max(0, 4 - Math.log10(1 + Math.abs(scale.map(at)))));
      expect(spanFraction(w, at - w.from)).toBeCloseTo(toFraction(w, at), 9);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));

  it('read zero for an empty window rather than NaN', () => {
    fc.assert(fc.property(ms, ms, (from, at) => {
      expect(toFraction({ from, to: from }, at)).toBe(0);
      expect(spanFraction({ from, to: from }, at)).toBe(0);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});

describe('window clamping, shrunk counterexamples', () => {
  it('a pan pinned to the end does not start an ulp before the bounds', () => {
    const b = { from: 1.0768832306988128e-107, to: 143045.4262719936 };
    expect(panWindow(b, 1, b).from).toBeGreaterThanOrEqual(b.from);
  });

  it('a pan of nothing gives back the very window', () => {
    const w = { from: 53081.463288690764, to: 219113.85398223755 };
    expect(panWindow(w, 0, { from: -1.5054195573600165e-32, to: 400728.22630727955 })).toEqual(w);
  });
});
