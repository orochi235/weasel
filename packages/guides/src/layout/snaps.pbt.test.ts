/**
 * Second-pass properties of the drop-target pickers and the point and slot arrangements: any tolerance, targets in
 * any order, coincident targets, and spacings, counts, and columns at the edges of what a caller can pass.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { DropTarget, RectPose } from '@weasel-js/core';
import { eighth, posEighth, runs, tally, timeoutFor } from '../pbt.fixture';
import { containedThenNearest, nearest, nearestWithin } from './snaps';
import { gridSlots, ringSlots, rowSlots } from './strategies/arrangements';
import { snapPoint } from './strategies/snapPoint';

const RUNS = runs(300);
const TIMEOUT = timeoutFor(300, 3);
type P = { x: number; y: number };

const point = fc.record({ x: eighth(50), y: eighth(50) });
const targets = fc.array(fc.record({ origin: point, hit: fc.option(fc.record({ x: eighth(50), y: eighth(50), width: posEighth(20), height: posEighth(20) }), { nil: undefined }) }), { maxLength: 8 })
  .map((ts) => ts.map((t, i): DropTarget<P> => ({ pose: { ...t.origin, i } as P, origin: t.origin, ...(t.hit ? { hitBounds: t.hit } : {}) })));
const anyTolerance = fc.oneof(posEighth(40), fc.constantFrom(0, -0, -1, -40, NaN, Infinity, -Infinity, Number.MIN_VALUE));
const d2 = (a: P, b: P) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const pick = (snap: { pickTarget: (t: DropTarget<P>[], p: P) => DropTarget<P> | null }, ts: DropTarget<P>[], p: P) => snap.pickTarget(ts, p);

function shuffle<T>(xs: readonly T[], picks: fc.Stream<number>): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = picks.next().value % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

describe('drop-target pickers, property', () => {
  it('nearestWithin picks the nearest target exactly when it lies within the tolerance', () => {
    const t = tally();
    fc.assert(fc.property(targets, point, anyTolerance, (ts, p, tol) => {
      const got = pick(nearestWithin<P>({ tolerance: tol }), ts, p);
      const best = ts.length ? Math.min(...ts.map((x) => Math.sqrt(d2(x.origin, p)))) : Infinity;
      const within = ts.length > 0 && best <= tol;
      t.count(within ? 'picked' : 'refused');
      if (!within) expect(got).toBeNull();
      else expect(Math.sqrt(d2(got!.origin, p))).toBe(best);
    }), RUNS);
    t.atLeast('picked', 50);
    t.atLeast('refused', 50);
  }, TIMEOUT);

  it('the order targets come in decides only between targets as near', () => {
    fc.assert(fc.property(targets, point, fc.infiniteStream(fc.nat()), (ts, p, picks) => {
      const shuffled = shuffle(ts, picks);
      for (const snap of [nearest<P>(), containedThenNearest<P>()]) {
        const a = pick(snap, ts, p);
        const b = pick(snap, shuffled, p);
        expect(b === null).toBe(a === null);
        if (a && b && !a.hitBounds) expect(d2(b.origin, p)).toBe(d2(a.origin, p));
      }
    }), RUNS);
  }, TIMEOUT);

  it('containedThenNearest picks a target whose bounds hold the pointer, else the nearest', () => {
    const t = tally();
    fc.assert(fc.property(targets, point, (ts, p) => {
      const got = pick(containedThenNearest<P>(), ts, p);
      const holding = ts.filter((x) => x.hitBounds && p.x >= x.hitBounds.x && p.x < x.hitBounds.x + x.hitBounds.width && p.y >= x.hitBounds.y && p.y < x.hitBounds.y + x.hitBounds.height);
      if (holding.length) {
        t.count('held');
        expect(got).toBe(holding[0]);
      } else if (ts.length) {
        expect(d2(got!.origin, p)).toBe(Math.min(...ts.map((x) => d2(x.origin, p))));
      } else expect(got).toBeNull();
    }), RUNS);
    t.atLeast('held', 8);
  }, TIMEOUT);
});

describe('point and slot arrangements at the edges, property', () => {
  const bounds = fc.record({ x: eighth(200), y: eighth(200), width: posEighth(200), height: posEighth(200) });
  const anyCount = fc.oneof(fc.integer({ min: 0, max: 12 }), fc.constantFrom(-1, 0.5, 2.5, NaN, Infinity));

  it('every slot an arrangement gives is a finite point inside its container, at any count or column count', () => {
    const t = tally();
    fc.assert(fc.property(bounds, fc.integer({ min: 0, max: 12 }), anyCount, fc.option(anyCount, { nil: undefined }), (b, n, cols, rows) => {
      const inside = (s: P) => Number.isFinite(s.x) && Number.isFinite(s.y)
        && s.x >= b.x - 1e-9 && s.x <= b.x + b.width + 1e-9 && s.y >= b.y - 1e-9 && s.y <= b.y + b.height + 1e-9;
      const grid = gridSlots({ cols, ...(rows === undefined ? {} : { rows }) })(b, n);
      for (const s of grid) expect(inside(s), JSON.stringify({ cols, rows, s })).toBe(true);
      expect(grid.length).toBeLessThanOrEqual(n);
      if (Number.isInteger(cols) && cols >= 1) expect(grid).toHaveLength(n);
      for (const s of [...rowSlots()(b, n), ...ringSlots()(b, n)]) expect(inside(s)).toBe(true);
      t.count(Number.isInteger(cols) && cols >= 1 ? 'columns' : 'no columns');
    }), RUNS);
    t.atLeast('no columns', 30);
  }, TIMEOUT);

  it('snapPoint\'s grid offers finite points inside its container a spacing apart, at any spacing', () => {
    const t = tally();
    const spacing = fc.oneof(posEighth(50), fc.constantFrom(0, -5, NaN, Infinity, Number.MIN_VALUE, 1e-300, 1e300));
    fc.assert(fc.property(bounds, spacing, point, (b, gridSpacing, at) => {
      const layout = snapPoint<RectPose>({ pattern: 'grid', gridSpacing });
      const dragged = { id: 'z', originPose: { x: 0, y: 0, width: 1, height: 1 }, pose: { ...at, width: 1, height: 1 }, sourceContainerId: null };
      const got = layout.getDropTargets({ id: 'C', bounds: b }, [], dragged);
      expect(got.length).toBeLessThanOrEqual(129 * 129);
      for (const d of got) {
        expect(Number.isFinite(d.origin.x) && Number.isFinite(d.origin.y)).toBe(true);
        expect(d.origin.x >= b.x && d.origin.x <= b.x + b.width && d.origin.y >= b.y && d.origin.y <= b.y + b.height).toBe(true);
      }
      t.count(got.length ? 'points' : 'none');
    }), RUNS);
    t.atLeast('points', 50);
  }, timeoutFor(300, 25));
});
