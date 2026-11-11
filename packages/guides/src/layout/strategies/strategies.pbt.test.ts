import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { LayoutChild, LayoutStrategy, RectPose } from '@weasel-js/core';
import { eighth, posEighth, runs, tally, timeoutFor } from '../../pbt.fixture';
import { gridSlots, ringSlots, rowSlots } from './arrangements';
import { pack } from './pack';
import { quadtree } from './quadtree';
import { slots } from './slots';

const RUNS = runs(200);
const TIMEOUT = timeoutFor(200, 10);
type P = RectPose;

const bounds = fc.record({ x: eighth(200), y: eighth(200), width: posEighth(200), height: posEighth(200) });
const container = bounds.map((b) => ({ id: 'C', bounds: b }));

/** Children with unique ids, anywhere, at most `maxSize` on a side. */
function children(maxSize: number, maxLength = 8): fc.Arbitrary<LayoutChild<P>[]> {
  return fc.array(
    fc.record({ x: eighth(300), y: eighth(300), width: posEighth(maxSize), height: posEighth(maxSize) }),
    { minLength: 1, maxLength },
  ).map((poses) => poses.map((pose, i) => ({ id: `n${i}`, pose })));
}

const overlaps = (a: P, b: P): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const rearranged = (kids: readonly LayoutChild<P>[], poses: Map<string, P>): LayoutChild<P>[] =>
  kids.map((c) => ({ id: c.id, pose: poses.get(c.id)! }));

/** Arranging an arrangement changes nothing. */
function expectFixedPoint(layout: LayoutStrategy<P>, c: { id: string; bounds: P }, kids: LayoutChild<P>[]): Map<string, P> {
  const once = layout.childPoses(c, kids);
  expect(layout.childPoses(c, rearranged(kids, once))).toEqual(once);
  return once;
}

describe('layout strategies, property', () => {
  it('pack shelves every child at its own size inside the width, overlapping none, and is a fixed point', () => {
    const t = tally();
    fc.assert(fc.property(container.chain((c) => fc.tuple(fc.constant(c), children(Math.min(c.bounds.width, 60)))), fc.integer({ min: 0, max: 16 }).map((n) => n / 2), ([c, kids], gap) => {
      const layout = pack<P>({ gap, overflow: 'scroll' });
      const poses = expectFixedPoint(layout, c, kids);
      const placed = kids.map((k) => poses.get(k.id)!);
      kids.forEach((k, i) => {
        const p = placed[i]!;
        expect([p.width, p.height]).toEqual([k.pose.width, k.pose.height]);
        expect(p.x).toBeGreaterThanOrEqual(c.bounds.x);
        expect(p.x + p.width).toBeLessThanOrEqual(c.bounds.x + c.bounds.width + 1e-9);
        expect(p.y).toBeGreaterThanOrEqual(c.bounds.y);
      });
      for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) expect(overlaps(placed[i]!, placed[j]!)).toBe(false);
      if (new Set(placed.map((p) => p.y)).size > 1) t.count('wrapped');
    }), RUNS);
    t.atLeast('wrapped', 30);
  }, TIMEOUT);

  it('a pack drop at each offered index lands there, and the result is a fixed point', () => {
    const t = tally();
    fc.assert(fc.property(container.filter((c) => c.bounds.width >= 20), children(20, 6), posEighth(20), fc.nat(), (c, kidsOf, size, pick) => {
      const layout = pack<P>({ gap: 2, overflow: 'scroll' });
      const kids = rearranged(kidsOf, layout.childPoses(c, kidsOf));
      const dragged = { id: 'z', originPose: { x: -999, y: -999, width: size, height: size }, pose: { x: c.bounds.x, y: c.bounds.y, width: size, height: size }, sourceContainerId: null };
      const targets = layout.getDropTargets(c, kids, dragged);
      expect(targets).toHaveLength(kids.length + 1);
      const target = targets[pick % targets.length]!;
      const shifted = layout.reflowPoses(c, kids, dragged, target);
      const after = [...kids.map((k) => ({ id: k.id, pose: shifted.get(k.id) ?? k.pose })), { id: 'z', pose: target.pose }];
      expect(layout.childPoses(c, after)).toEqual(new Map(after.map((k) => [k.id, k.pose])));
      t.count('dropped');
    }), RUNS);
    t.atLeast('dropped', 100);
  }, TIMEOUT);

  it('quadtree gives each child a cell that fits it, no two cells nesting, and is a fixed point', () => {
    const t = tally();
    fc.assert(fc.property(container.chain((c) => fc.tuple(fc.constant(c), children(Math.max(1, Math.min(c.bounds.width, c.bounds.height) / 2), 10))), fc.integer({ min: 0, max: 4 }), ([c, kids], maxDepth) => {
      const layout = quadtree<P>({ maxDepth });
      expectFixedPoint(layout, c, kids);
      const cells = layout.cells(c, kids);
      for (const cell of cells) {
        const kid = kids.find((k) => k.id === cell.id)!;
        if (cell.depth > 0) expect(Math.min(cell.rect.width, cell.rect.height)).toBeGreaterThanOrEqual(Math.max(kid.pose.width, kid.pose.height));
        t.count(`depth ${cell.depth}`);
      }
      for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) expect(overlaps(cells[i]!.rect, cells[j]!.rect)).toBe(false);
      if (cells.length < kids.length) t.count('refused');
    }), RUNS);
    t.atLeast('depth 0', 20);
    t.atLeast('depth 2', 20);
    t.atLeast('refused', 10);
  }, TIMEOUT);

  it('slots in a row, a grid, or a ring hold one child each and are a fixed point', () => {
    const t = tally();
    const arrangement = fc.oneof(
      fc.record({ axis: fc.constantFrom<'x' | 'y'>('x', 'y'), pitch: fc.option(posEighth(40), { nil: undefined }) }).map((o) => ({ name: 'row', a: rowSlots(o) })),
      fc.record({ cols: fc.integer({ min: 1, max: 5 }), rows: fc.option(fc.integer({ min: 1, max: 4 }), { nil: undefined }) }).map((o) => ({ name: 'grid', a: gridSlots(o) })),
      fc.record({ start: fc.double({ min: -4, max: 4, noNaN: true }), sweep: fc.option(fc.double({ min: 0.5, max: 7, noNaN: true }), { nil: undefined }) }).map((o) => ({ name: 'ring', a: ringSlots(o) })),
    );
    fc.assert(fc.property(container, arrangement, children(10), ({ bounds: b, id }, { name, a }, kids) => {
      const c = { id, bounds: { ...b, width: b.width + 50, height: b.height + 50 } };
      const layout = slots<P>({ arrangement: a });
      const poses = expectFixedPoint(layout, c, kids);
      const places = a(c.bounds, kids.length);
      const centers = kids.map((k) => { const p = poses.get(k.id)!; return `${p.x + p.width / 2},${p.y + p.height / 2}`; });
      for (const s of centers) expect(places.some((q) => Math.abs(Number(s.split(',')[0]) - q.x) < 1e-9 * (1 + Math.abs(q.x)) && Math.abs(Number(s.split(',')[1]) - q.y) < 1e-9 * (1 + Math.abs(q.y)))).toBe(true);
      expect(new Set(centers).size).toBe(kids.length);
      t.count(name);
    }), RUNS);
    t.atLeast('row', 30);
    t.atLeast('grid', 30);
    t.atLeast('ring', 30);
  }, TIMEOUT);

  it('a row of slots is evenly spaced and centered in its container', () => {
    fc.assert(fc.property(bounds, fc.integer({ min: 1, max: 12 }), fc.option(posEighth(40), { nil: undefined }), fc.constantFrom<'x' | 'y'>('x', 'y'), (b, n, pitch, axis) => {
      const s = rowSlots({ axis, ...(pitch === undefined ? {} : { pitch }) })(b, n);
      expect(s).toHaveLength(n);
      const along = s.map((p) => p[axis]);
      const step = pitch ?? (axis === 'x' ? b.width : b.height) / n;
      for (let i = 1; i < n; i++) expect(along[i]! - along[i - 1]!).toBeCloseTo(step, 9);
      const mid = axis === 'x' ? b.x + b.width / 2 : b.y + b.height / 2;
      expect((along[0]! + along[n - 1]!) / 2).toBeCloseTo(mid, 9);
    }), RUNS);
  }, TIMEOUT);

  it('grid and ring slots sit inside their container', () => {
    fc.assert(fc.property(bounds, fc.integer({ min: 0, max: 20 }), fc.integer({ min: 1, max: 6 }), (b, n, cols) => {
      const inside = (p: { x: number; y: number }) =>
        p.x >= b.x - 1e-9 && p.x <= b.x + b.width + 1e-9 && p.y >= b.y - 1e-9 && p.y <= b.y + b.height + 1e-9;
      expect(gridSlots({ cols })(b, n).every(inside)).toBe(true);
      expect(ringSlots()(b, n).every(inside)).toBe(true);
      expect(gridSlots({ cols })(b, n)).toHaveLength(n);
    }), RUNS);
  }, TIMEOUT);
});
