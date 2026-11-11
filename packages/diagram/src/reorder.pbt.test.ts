/**
 * `sequenceSlots` on any run of items laid end to end along an axis: a gap before each item and one after the last,
 * in order, each bar halfway between its neighbors, outside the run at either end, and spanning across the items
 * beside it.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { nonFinite, runs, timeoutFor } from './pbt.fixture';
import { sequenceSlots, type ReorderItem } from './reorder';

const RUNS = 300;

const run = fc.tuple(
  fc.integer({ min: -500, max: 500 }),
  fc.array(fc.record({ gap: fc.integer({ min: 0, max: 40 }), size: fc.integer({ min: 0, max: 80 }), across: fc.integer({ min: -30, max: 30 }), depth: fc.integer({ min: 0, max: 60 }) }), { maxLength: 7 }),
);

describe('sequenceSlots', () => {
  it.each(['x', 'y'] as const)('lays a gap before each item and after the last, in order, along %s', (axis) => {
    fc.assert(fc.property(run, ([start, specs]) => {
      let at = start;
      const items: ReorderItem[] = specs.map(({ gap, size, across, depth }, k) => {
        at += gap;
        const box = axis === 'x' ? { x: at, y: across, width: size, height: depth } : { x: across, y: at, width: depth, height: size };
        at += size;
        return { id: `i${k}`, bounds: box };
      });
      const slots = sequenceSlots(axis, items);
      expect(nonFinite(slots.gaps)).toEqual([]);
      expect(slots.gaps.map((g) => g.index)).toEqual(items.length === 0 ? [] : items.map((_, k) => k).concat(items.length));
      const cross = axis === 'x' ? 'y' : 'x';
      const lo = (k: number) => items[k]!.bounds[axis];
      const hi = (k: number) => items[k]!.bounds[axis] + (axis === 'x' ? items[k]!.bounds.width : items[k]!.bounds.height);
      const top = (k: number) => items[k]!.bounds[cross];
      const bottom = (k: number) => top(k) + (axis === 'x' ? items[k]!.bounds.height : items[k]!.bounds.width);
      slots.gaps.forEach((g, k) => {
        expect(g.a[axis]).toBe(g.b[axis]);
        if (k > 0 && k < items.length) {
          expect(g.a[axis]).toBe((hi(k - 1) + lo(k)) / 2);
          expect(g.a[cross]).toBe(Math.min(top(k - 1), top(k)));
          expect(g.b[cross]).toBe(Math.max(bottom(k - 1), bottom(k)));
        }
        if (k > 0) expect(g.a[axis]).toBeGreaterThanOrEqual(slots.gaps[k - 1]!.a[axis]);
      });
      if (items.length > 0) {
        expect(slots.gaps[0]!.a[axis]).toBeLessThanOrEqual(lo(0));
        expect(slots.gaps[items.length]!.a[axis]).toBeGreaterThanOrEqual(hi(items.length - 1));
      }
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});
