/**
 * Property tests for the pure halves of align and distribute (`alignDeltaFor`, `alignTargetBounds`,
 * `planDistribute`), `settleWithinRounding` beneath both, and `childVerdict`'s rule for a parent with no pages.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { asNodeId } from 'core/scene/types';
import { alignDeltaFor, alignTargetBounds, type AlignEdge } from './align/align';
import { planDistribute } from './distribute/plan';
import { settleWithinRounding } from './settleWithinRounding';
import { childVerdict } from './admitsChild';
import { runs, tally, timeoutFor } from './pbt.fixture';

const N = 200;
const coord = (limit: number) => fc.double({ min: -limit, max: limit, noNaN: true, noDefaultInfinity: true });
const extent = (limit: number) => fc.double({ min: 1e-3, max: limit, noNaN: true, noDefaultInfinity: true });
const box = (limit = 1e4): fc.Arbitrary<Bounds> =>
  fc.record({ x: coord(limit), y: coord(limit), width: extent(limit), height: extent(limit) });
const EDGES: AlignEdge[] = ['left', 'right', 'top', 'bottom', 'center-x', 'center-y'];
const edge = fc.constantFrom(...EDGES);

const shift = (b: Bounds, dx: number, dy: number): Bounds => ({ ...b, x: b.x + dx, y: b.y + dy });
const FEATURE: Record<AlignEdge, (b: Bounds) => number> = {
  left: (b) => b.x, right: (b) => b.x + b.width, 'center-x': (b) => b.x + b.width / 2,
  top: (b) => b.y, bottom: (b) => b.y + b.height, 'center-y': (b) => b.y + b.height / 2,
};
const horizontal = (e: AlignEdge) => e === 'left' || e === 'right' || e === 'center-x';
const close = (a: number, b: number, scale: number) => Math.abs(a - b) <= 2e-9 * Math.max(1, Math.abs(scale));

describe('alignDeltaFor', () => {
  it('lands the edge on the target, moves along one axis only, and finds nothing left to do after', () => {
    fc.assert(fc.property(box(), box(), edge, (b, u, e) => {
      const { dx, dy } = alignDeltaFor(b, u, e);
      expect(Number.isFinite(dx) && Number.isFinite(dy)).toBe(true);
      expect(horizontal(e) ? dy : dx).toBe(0);
      const moved = shift(b, dx, dy);
      const scale = Math.max(...[b, u].flatMap((q) => [q.x, q.y, q.x + q.width, q.y + q.height].map(Math.abs)));
      expect(close(FEATURE[e](moved), FEATURE[e](u), scale), `${FEATURE[e](moved)} vs ${FEATURE[e](u)}`).toBe(true);
      expect(alignDeltaFor(moved, u, e)).toEqual({ dx: 0, dy: 0 });
    }), runs(N));
  }, timeoutFor(N, 1));

  it('moving the box and the target together changes nothing', () => {
    fc.assert(fc.property(box(), box(), edge, coord(1e4), coord(1e4), (b, u, e, tx, ty) => {
      const a = alignDeltaFor(b, u, e);
      const t = alignDeltaFor(shift(b, tx, ty), shift(u, tx, ty), e);
      expect(close(a.dx, t.dx, 4e4) && close(a.dy, t.dy, 4e4), `${JSON.stringify([a, t])}`).toBe(true);
    }), runs(N));
  }, timeoutFor(N, 1));
});

describe('alignTargetBounds', () => {
  it('aligns to the union under the default reference, which needs two boxes and holds them all', () => {
    fc.assert(fc.property(fc.array(box(), { maxLength: 6 }), fc.constantFrom(undefined, 'union' as const), (bs, to) => {
      const u = alignTargetBounds(bs, to, { pointer: () => null, nodeBounds: () => null });
      if (bs.length < 2) { expect(u).toBeNull(); return; }
      expect(u).not.toBeNull();
      for (const b of bs) {
        expect(b.x).toBeGreaterThanOrEqual(u!.x);
        expect(b.y).toBeGreaterThanOrEqual(u!.y);
        expect(b.x + b.width).toBeLessThanOrEqual(u!.x + u!.width + 1e-9 * Math.abs(u!.x + u!.width));
        expect(b.y + b.height).toBeLessThanOrEqual(u!.y + u!.height + 1e-9 * Math.abs(u!.y + u!.height));
      }
      // Each side of the union is some box's side.
      expect(bs.some((b) => b.x === u!.x)).toBe(true);
      expect(bs.some((b) => b.y === u!.y)).toBe(true);
    }), runs(N));
  }, timeoutFor(N, 1));
});

describe('planDistribute', () => {
  const seen = tally();
  const axis = fc.constantFrom('x' as const, 'y' as const);
  /** Boxes laid out along `ax` without overlapping, in a shuffled order: the case a gaps distribute spaces. */
  const laidOut = fc.tuple(
    coord(1e3),
    fc.array(fc.tuple(extent(100), fc.double({ min: 0, max: 100, noNaN: true }), coord(1e3), extent(100)), { minLength: 1, maxLength: 8 }),
    fc.boolean(),
  ).chain(([start, runs, onX]) => {
    let at = start;
    const placed = runs.map(([size, gap, other, otherSize]) => {
      const lo = at + gap;
      at = lo + size;
      return onX ? { x: lo, y: other, width: size, height: otherSize } : { x: other, y: lo, width: otherSize, height: size };
    });
    return fc.shuffledSubarray(placed, { minLength: placed.length, maxLength: placed.length });
  });
  const boxes = fc.oneof(fc.array(box(1e3), { minLength: 1, maxLength: 8 }), laidOut);
  /** Boxes on an eighth grid, where moving them is exact. */
  const gridBoxes = fc.array(fc.record({
    x: fc.integer({ min: -8000, max: 8000 }), y: fc.integer({ min: -8000, max: 8000 }),
    width: fc.integer({ min: 1, max: 800 }), height: fc.integer({ min: 1, max: 800 }),
  }).map((b) => ({ x: b.x / 8, y: b.y / 8, width: b.width / 8, height: b.height / 8 })), { minLength: 1, maxLength: 8 });

  /** Each box at its planned start along `ax`. */
  const placed = (bs: Bounds[], ax: 'x' | 'y', targets: number[]): Bounds[] =>
    bs.map((b, i) => (ax === 'x' ? { ...b, x: targets[i]! } : { ...b, y: targets[i]! }));

  it('centers: finite, evenly spaced between the outermost two centers, and planned no further once spaced', () => {
    fc.assert(fc.property(boxes, axis, (bs, ax) => {
      const lo = (b: Bounds) => (ax === 'x' ? b.x : b.y);
      const size = (b: Bounds) => (ax === 'x' ? b.width : b.height);
      const center = (b: Bounds) => lo(b) + size(b) / 2;
      const targets = planDistribute(bs, ax, 'centers');
      expect(targets.every(Number.isFinite)).toBe(true);
      const after = placed(bs, ax, targets);
      const was = bs.map(center);
      const cs = after.map(center).sort((p, q) => p - q);
      expect(close(cs[0]!, Math.min(...was), 2e3)).toBe(true);
      expect(close(cs.at(-1)!, Math.max(...was), 2e3)).toBe(true);
      const step = cs.length > 1 ? (cs.at(-1)! - cs[0]!) / (cs.length - 1) : 0;
      cs.forEach((c, i) => expect(close(c, cs[0]! + step * i, 2e3), `${cs}`).toBe(true));
      expect(planDistribute(after, ax, 'centers')).toEqual(after.map(lo));
      if (bs.length >= 3) seen.count('centers');
    }), runs(N));
    expect(seen.get('centers'), seen.dump()).toBeGreaterThan(runs(N).numRuns / 4);
  }, timeoutFor(N, 1));

  it('gaps: the first and last boxes stay, and boxes that fit between them are left equal gaps, then planned no further', () => {
    fc.assert(fc.property(boxes, axis, (bs, ax) => {
      const lo = (b: Bounds) => (ax === 'x' ? b.x : b.y);
      const size = (b: Bounds) => (ax === 'x' ? b.width : b.height);
      const targets = planDistribute(bs, ax, 'gaps');
      expect(targets.every(Number.isFinite)).toBe(true);
      const sorted = bs.map((b, i) => ({ b, i })).sort((p, q) => lo(p.b) - lo(q.b));
      expect(targets[sorted[0]!.i]).toBe(lo(sorted[0]!.b));
      expect(targets[sorted.at(-1)!.i]).toBe(lo(sorted.at(-1)!.b));
      const span = lo(sorted.at(-1)!.b) + size(sorted.at(-1)!.b) - lo(sorted[0]!.b);
      // Boxes that overlap past fitting are left negative gaps, and which are the ends is open (docs/unruled.md).
      if (bs.reduce((s, b) => s + size(b), 0) > span) return;
      const after = placed(bs, ax, targets).sort((p, q) => lo(p) - lo(q));
      const gaps = after.slice(1).map((b, i) => lo(b) - (lo(after[i]!) + size(after[i]!)));
      for (const g of gaps) expect(close(g, gaps[0]!, 2e3), `${gaps}`).toBe(true);
      const again = placed(bs, ax, targets);
      expect(planDistribute(again, ax, 'gaps')).toEqual(again.map(lo));
      if (bs.length >= 3) seen.count('gaps fit');
    }), runs(N));
    expect(seen.get('gaps fit'), seen.dump()).toBeGreaterThan(runs(N).numRuns / 20);
  }, timeoutFor(N, 1));

  it('moving every box along the axis moves every target with it', () => {
    fc.assert(fc.property(gridBoxes, axis, fc.constantFrom('centers' as const, 'gaps' as const), fc.integer({ min: -1000, max: 1000 }), (bs, ax, mode, t) => {
      const moved = bs.map((b) => (ax === 'x' ? shift(b, t, 0) : shift(b, 0, t)));
      const a = planDistribute(bs, ax, mode);
      const b = planDistribute(moved, ax, mode);
      a.forEach((v, i) => expect(close(v + t, b[i]!, 4e3), `${v + t} vs ${b[i]}`).toBe(true));
    }), runs(N));
  }, timeoutFor(N, 1));
});

describe('settleWithinRounding', () => {
  it('answers the target or, within rounding at the scale, the current value', () => {
    fc.assert(fc.property(coord(1e6), coord(1e6), coord(1e6), (current, target, scale) => {
      const got = settleWithinRounding(current, target, scale);
      expect(got === current || got === target).toBe(true);
      if (got !== target) expect(Math.abs(target - current)).toBeLessThanOrEqual(Math.max(1, Math.abs(scale)) * 1e-9);
      expect(settleWithinRounding(current, current, scale)).toBe(current);
    }), runs(N));
  }, timeoutFor(N, 1));
});

describe('childVerdict without pages', () => {
  it('a locked parent takes nothing; otherwise canDropInto decides when given, else a group does and a mark does not', () => {
    const kinds = fc.constantFrom('group', 'mark', 'text', 'path');
    fc.assert(fc.property(kinds, fc.boolean(), fc.option(fc.boolean(), { nil: undefined }), fc.array(fc.string({ maxLength: 4 }), { maxLength: 3 }),
      (kind, locked, drop, ids) => {
        const parent = asNodeId('p');
        const scene = {
          get: (id: string) => (id === 'p' ? { kind } : { kind: 'mark' }),
          isLocked: (id: string) => id === 'p' && locked,
        };
        const canDropInto = drop === undefined ? undefined : () => drop;
        const want = locked ? false : drop !== undefined ? drop : kind === 'group';
        expect(childVerdict(scene as never, parent, ids, canDropInto)).toBe(want);
      }), runs(N));
  }, timeoutFor(N, 1));
});
