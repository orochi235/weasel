import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Bounds } from '@weasel-js/core';
import { eighth, runs, tally, timeoutFor } from '../pbt.fixture';
import { measureDistances } from './distance';

const RUNS = runs(400);
const TIMEOUT = timeoutFor(400, 1);
type Axis = 'x' | 'y';

const lo = (b: Bounds, a: Axis) => (a === 'x' ? b.x : b.y);
const hi = (b: Bounds, a: Axis) => (a === 'x' ? b.x + b.width : b.y + b.height);

/** Boxes on a coarse lattice, so they separate, nest, meet flush, and overlap in turn. */
const rect = fc.record({
  x: fc.integer({ min: 0, max: 10 }).map((n) => n * 10),
  y: fc.integer({ min: 0, max: 10 }).map((n) => n * 10),
  width: fc.integer({ min: 0, max: 6 }).map((n) => n * 10),
  height: fc.integer({ min: 0, max: 6 }).map((n) => n * 10),
});

const spans = (gaps: readonly { axis: Axis; min: number; max: number }[]) => gaps.map((g) => `${g.axis}:${g.min}:${g.max}`).sort();

describe('measureDistances, property', () => {
  it('measures a separation on an axis as exactly the space between the boxes', () => {
    const t = tally();
    fc.assert(fc.property(rect, rect, (a, b) => {
      const out = measureDistances(a, b);
      for (const axis of ['x', 'y'] as const) {
        const gaps = out.gaps.filter((g) => g.axis === axis);
        const space = Math.max(lo(b, axis) - hi(a, axis), lo(a, axis) - hi(b, axis));
        if (space > 0) {
          t.count('apart');
          expect(gaps).toHaveLength(1);
          expect(gaps[0]!.max - gaps[0]!.min).toBe(space);
        }
        for (const g of gaps) expect(g.max).toBeGreaterThan(g.min);
      }
      for (const l of out.leaders) {
        t.count('leader');
        expect(l.span!.max).toBeGreaterThanOrEqual(l.span!.min);
      }
    }), RUNS);
    t.atLeast('apart', 200);
    t.atLeast('leader', 50);
  }, TIMEOUT);

  it('measures the same stretches from either box', () => {
    const t = tally();
    fc.assert(fc.property(rect, rect, (a, b) => {
      const ab = measureDistances(a, b);
      expect(spans(measureDistances(b, a).gaps)).toEqual(spans(ab.gaps));
      if (ab.gaps.length > 0) t.count('measured');
    }), RUNS);
    t.atLeast('measured', 200);
  }, TIMEOUT);

  it('moves with the boxes', () => {
    fc.assert(fc.property(rect, rect, eighth(500), eighth(500), (a, b, dx, dy) => {
      const m = (r: Bounds): Bounds => ({ ...r, x: r.x + dx, y: r.y + dy });
      const at = (axis: Axis) => (axis === 'x' ? { along: dx, across: dy } : { along: dy, across: dx });
      const want = measureDistances(a, b);
      const got = measureDistances(m(a), m(b));
      expect(got.gaps).toEqual(want.gaps.map((g) => ({ ...g, min: g.min + at(g.axis).along, max: g.max + at(g.axis).along, at: g.at + at(g.axis).across })));
      expect(got.leaders).toEqual(want.leaders.map((l) => ({
        ...l, offset: l.offset + at(l.axis).along, span: { min: l.span!.min + at(l.axis).across, max: l.span!.max + at(l.axis).across },
      })));
    }), RUNS);
  }, TIMEOUT);

  it('draws no leader from a box with no height whose gap already meets the other box (shrunk counterexample)', () => {
    // It drew one running backward, from y 10 to y 0.
    expect(measureDistances({ x: 0, y: 0, width: 0, height: 0 }, { x: 10, y: 0, width: 0, height: 10 }).leaders).toEqual([]);
    expect(measureDistances({ x: 0, y: 5, width: 4, height: 0 }, { x: 10, y: 0, width: 5, height: 10 }).leaders).toEqual([]);
  });
});
