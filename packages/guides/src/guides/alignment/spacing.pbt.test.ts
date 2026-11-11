import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Bounds } from '@weasel-js/core';
import { eighth, runs, tally, timeoutFor } from '../../pbt.fixture';
import type { SpacingGap } from '../types';
import { applyEdges, matchSpacing, measureGaps } from './spacing';
import type { SpacingEdge } from './types';

const RUNS = runs(300);
const TIMEOUT = timeoutFor(300, 3);
type Axis = 'x' | 'y';
const EPS = 1e-6;

const lo = (b: Bounds, a: Axis) => (a === 'x' ? b.x : b.y);
const hi = (b: Bounds, a: Axis) => (a === 'x' ? b.x + b.width : b.y + b.height);
const cross = (a: Axis): Axis => (a === 'x' ? 'y' : 'x');

/** Boxes on a small eighth lattice with area, so they line up, share rows, and tie often. */
const scattered = fc.array(
  fc.record({
    x: fc.integer({ min: 0, max: 6 }).map((n) => n * 20),
    y: fc.integer({ min: 0, max: 3 }).map((n) => n * 20),
    width: fc.integer({ min: 1, max: 3 }).map((n) => n * 5),
    height: fc.integer({ min: 1, max: 4 }).map((n) => n * 5),
  }),
  { maxLength: 4 },
);

/** Boxes in a run along `axis` from (`x`, `y`), a gap from a short list between each. */
const run = (axis: Axis) => fc.record({
  x: fc.integer({ min: 0, max: 8 }).map((n) => n * 10),
  y: fc.integer({ min: 0, max: 5 }).map((n) => n * 10),
  parts: fc.array(fc.record({ size: fc.integer({ min: 1, max: 3 }).map((n) => n * 5), gap: fc.constantFrom(5, 10, 15) }), { minLength: 2, maxLength: 4 }),
}).map(({ x, y, parts }) => {
  let at = axis === 'x' ? x : y;
  return parts.map(({ size, gap }): Bounds => {
    const b = axis === 'x' ? { x: at, y, width: size, height: 10 } : { x, y: at, width: 10, height: size };
    at += size + gap;
    return b;
  });
});

/** A row, a column, and a few boxes scattered over them, in no order. */
const layout = fc.tuple(run('x'), run('y'), scattered, fc.integer())
  .map(([row, col, rest, seed]) => [...row, ...col, ...rest].map((b, i) => ({ b, k: (i * 7919 + seed) % 17 })).sort((p, q) => p.k - q.k).map((e) => e.b));

/** Where two boxes share `axis`, by the rule `measureGaps` documents. */
function shared(a: Bounds, b: Bounds, axis: Axis): [number, number] | null {
  const min = Math.max(lo(a, axis), lo(b, axis));
  const max = Math.min(hi(a, axis), hi(b, axis));
  return max - min > EPS ? [min, max] : null;
}

/** The documented gaps, from scratch: each box to every nearest box to its right that shares
 *  some of its cross range, kept where no third box stands in the strip between them. */
function oracle(targets: readonly Bounds[], axis: Axis): SpacingGap[] {
  const c = cross(axis);
  const out: SpacingGap[] = [];
  for (const a of targets) {
    const right = targets.filter((t) => t !== a && lo(t, axis) >= hi(a, axis) + EPS && shared(a, t, c));
    if (right.length === 0) continue;
    const nearest = Math.min(...right.map((t) => lo(t, axis)));
    for (const b of right.filter((t) => lo(t, axis) === nearest)) {
      const span = shared(a, b, c)!;
      const blocked = targets.some((t) => t !== a && t !== b
        && lo(t, axis) < nearest - EPS && hi(t, axis) > hi(a, axis) + EPS
        && lo(t, c) < span[1] - EPS && hi(t, c) > span[0] + EPS);
      if (!blocked) out.push({ axis, min: hi(a, axis), max: nearest, at: (span[0] + span[1]) / 2 });
    }
  }
  return out;
}

const key = (g: SpacingGap) => `${g.axis}:${g.min}:${g.max}:${g.at}`;
const sortedKeys = (gs: readonly SpacingGap[]) => gs.map(key).sort();

/** A layout, and a box dropped beside one of its boxes, a few units off one of its gaps' width from it, or anywhere. */
const scene = layout.chain((targets) => fc.record({
  targets: fc.constant(targets),
  b: fc.record({
    of: fc.integer({ min: 0, max: targets.length - 1 }),
    axis: fc.constantFrom<Axis>('x', 'y'),
    gap: fc.constantFrom(5, 10, 15, ...[...oracle(targets, 'x'), ...oracle(targets, 'y')].map((g) => g.max - g.min)),
    after: fc.boolean(),
    jitter: fc.integer({ min: -40, max: 40 }).map((n) => n / 8),
    across: fc.integer({ min: -40, max: 40 }).map((n) => n / 8),
    width: fc.integer({ min: 1, max: 4 }).map((n) => n * 5),
    height: fc.integer({ min: 1, max: 4 }).map((n) => n * 5),
    loose: fc.option(fc.record({ x: eighth(150), y: eighth(100) }), { freq: 5 }),
  }).map(({ of, axis, gap, after, jitter, across, width, height, loose }): Bounds => {
    if (loose) return { ...loose, width, height };
    const t = targets[of]!;
    const size = axis === 'x' ? width : height;
    const along = (after ? hi(t, axis) + gap : lo(t, axis) - gap - size) + jitter;
    const c = lo(t, cross(axis)) + across;
    return axis === 'x' ? { x: along, y: c, width, height } : { x: c, y: along, width, height };
  }),
}));

describe('equal spacing, property', () => {
  it('measureGaps finds the documented gaps, whatever order the boxes come in', () => {
    const t = tally();
    fc.assert(fc.property(layout, fc.constantFrom<Axis>('x', 'y'), fc.integer(), (boxes, axis, seed) => {
      const want = sortedKeys(oracle(boxes, axis));
      expect(sortedKeys(measureGaps(boxes, axis))).toEqual(want);
      const shuffled = [...boxes].sort((p, q) => ((boxes.indexOf(p) * 7919 + seed) % 13) - ((boxes.indexOf(q) * 7919 + seed) % 13));
      expect(sortedKeys(measureGaps(shuffled, axis))).toEqual(want);
      if (want.length > 0) t.count('gaps');
      if (want.length > 2) t.count('several');
    }), RUNS);
    t.atLeast('gaps', 100);
    t.atLeast('several', 20);
  }, TIMEOUT);

  it('a match moves the box no farther than the tolerance, and only the edges it may move', () => {
    const t = tally();
    const edge = fc.constantFrom<SpacingEdge | null>('both', 'both', 'min', 'max', null);
    fc.assert(fc.property(scene, fc.integer({ min: 0, max: 80 }).map((n) => n / 8), edge, edge, ({ b, targets }, tol, mx, my) => {
      const m = matchSpacing(b, targets, { x: tol, y: tol }, { x: mx, y: my });
      expect(Math.abs(m.dx)).toBeLessThanOrEqual(tol);
      expect(Math.abs(m.dy)).toBeLessThanOrEqual(tol);
      if (mx === null) expect(m.dx).toBe(0);
      if (my === null) expect(m.dy).toBe(0);
      t.count(m.gapsX.length + m.gapsY.length > 0 ? 'snapped' : 'nothing');
    }), RUNS);
    t.atLeast('snapped', 20);
    t.atLeast('nothing', 10);
  }, TIMEOUT);

  it('a translate snapped to a gap lands with that gap beside the box, and marks it', () => {
    const t = tally();
    fc.assert(fc.property(scene, ({ b, targets }) => {
      // Open in docs/unruled.md: a box overlapping a sibling offers gaps that sibling blocks.
      fc.pre(!targets.some((t) => shared(t, b, 'x') && shared(t, b, 'y')));
      const m = matchSpacing(b, targets, { x: 5, y: 5 });
      const final = applyEdges(b, m.dx, m.dy, { x: 'both', y: 'both' });
      for (const [axis, gaps, other] of [['x', m.gapsX, m.dy], ['y', m.gapsY, m.dx]] as const) {
        if (gaps.length === 0) continue;
        // Open in docs/unruled.md: a snap on the other axis can carry the box out of the row that set this one.
        if (other !== 0) {
          t.count('both axes');
          continue;
        }
        t.count(`snapped ${axis}`);
        const size = gaps[0]!.max - gaps[0]!.min;
        for (const g of gaps) expect(Math.abs(g.max - g.min - size)).toBeLessThan(1e-3);
        const touching = gaps.filter((g) => Math.abs(g.max - lo(final, axis)) < EPS || Math.abs(g.min - hi(final, axis)) < EPS);
        expect(touching.length, JSON.stringify({ final, gaps })).toBeGreaterThan(0);
      }
    }), RUNS);
    t.atLeast('snapped x', 15);
    t.atLeast('snapped y', 10);
  }, TIMEOUT);

  it('translating the whole layout carries the match with it', () => {
    const t = tally();
    fc.assert(fc.property(scene, eighth(500), eighth(500), ({ b, targets }, sx, sy) => {
      const move = (r: Bounds): Bounds => ({ ...r, x: r.x + sx, y: r.y + sy });
      const a = matchSpacing(b, targets, { x: 8, y: 8 });
      const m = matchSpacing(move(b), targets.map(move), { x: 8, y: 8 });
      expect(m.dx).toBe(a.dx);
      expect(m.dy).toBe(a.dy);
      const shift = (g: SpacingGap): SpacingGap => g.axis === 'x'
        ? { ...g, min: g.min + sx, max: g.max + sx, at: g.at + sy }
        : { ...g, min: g.min + sy, max: g.max + sy, at: g.at + sx };
      expect(sortedKeys(m.gapsX)).toEqual(sortedKeys(a.gapsX.map(shift)));
      expect(sortedKeys(m.gapsY)).toEqual(sortedKeys(a.gapsY.map(shift)));
      if (a.gapsX.length + a.gapsY.length > 0) t.count('matched');
    }), RUNS);
    t.atLeast('matched', 50);
  }, TIMEOUT);

  it('measures a gap to each box tied for nearest, in either order (shrunk counterexample)', () => {
    // It measured the gap to whichever of the two came first.
    const a = { x: 0, y: 0, width: 10, height: 20 };
    const top = { x: 30, y: 0, width: 10, height: 5 };
    const bottom = { x: 30, y: 10, width: 10, height: 5 };
    const want = [{ axis: 'x', min: 10, max: 30, at: 2.5 }, { axis: 'x', min: 10, max: 30, at: 12.5 }];
    expect(measureGaps([a, top, bottom], 'x')).toEqual(want);
    expect(measureGaps([a, bottom, top], 'x')).toEqual(want);
  });

  it('marks the gap a snap reproduced beside the box, though its neighbor has a nearer one elsewhere (shrunk counterexample)', () => {
    // The left neighbor's nearest box to its right sits lower, so measuring from it never reached the box.
    const targets = [
      { x: 0, y: 40, width: 15, height: 5 }, { x: 70, y: 40, width: 10, height: 15 }, { x: 85, y: 50, width: 5, height: 10 },
    ];
    const m = matchSpacing({ x: 135, y: 35, width: 5, height: 10 }, targets, { x: 5, y: 5 }, { x: 'both', y: null });
    expect(m.dx).toBe(0);
    expect(m.gapsX.map((g) => [g.min, g.max])).toEqual([[15, 70], [80, 135]]);
  });
});

