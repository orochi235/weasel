import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { alignedStrokeRect, alignedStrokeRectHolds } from './alignedStrokeRect';
import { runs } from './pbt.fixture';

const RUNS = runs(300);
const coord = fc.double({ min: -1000, max: 1000, noNaN: true });
const extent = fc.double({ min: -500, max: 500, noNaN: true });
const rect = fc.record({ x: coord, y: coord, width: extent, height: extent });
const strokeWidth = fc.double({ min: 0, max: 100, noNaN: true });
type Rect = { x: number; y: number; width: number; height: number };
const normalized = (r: Rect): Rect => ({
  x: Math.min(r.x, r.x + r.width), y: Math.min(r.y, r.y + r.height), width: Math.abs(r.width), height: Math.abs(r.height),
});
const near = (a: Rect, b: Rect): boolean => [a.x - b.x, a.y - b.y, a.width - b.width, a.height - b.height].every((d) => Math.abs(d) < 1e-9);

describe('alignedStrokeRect, property', () => {
  it('leaves a centered stroke\'s rect alone, and outer undoes inner while inner holds', () => {
    fc.assert(fc.property(rect, strokeWidth, (r, w) => {
      expect(alignedStrokeRect(r, 'center', w)).toBe(r);
      if (alignedStrokeRectHolds(r, 'inner', w)) expect(near(alignedStrokeRect(alignedStrokeRect(r, 'inner', w), 'outer', w), r)).toBe(true);
    }), RUNS);
  });

  it('shifts a rect drawn backward as it shifts the same rect drawn forward', () => {
    fc.assert(fc.property(rect, strokeWidth, fc.constantFrom('inner', 'outer') as fc.Arbitrary<'inner' | 'outer'>, (r, w, align) => {
      if (!alignedStrokeRectHolds(r, align, w)) return;
      expect(near(normalized(alignedStrokeRect(r, align, w)), alignedStrokeRect(normalized(r), align, w))).toBe(true);
    }), RUNS);
  });

  it('moves each edge by half the stroke, outward for outer and inward for inner, while the rect holds', () => {
    fc.assert(fc.property(rect, strokeWidth, fc.constantFrom('inner', 'outer') as fc.Arbitrary<'inner' | 'outer'>, (r, w, align) => {
      if (!alignedStrokeRectHolds(r, align, w)) return;
      const n = normalized(r), m = normalized(alignedStrokeRect(r, align, w));
      const d = align === 'outer' ? w / 2 : -w / 2;
      expect(near(m, { x: n.x - d, y: n.y - d, width: n.width + 2 * d, height: n.height + 2 * d })).toBe(true);
    }), RUNS);
  });
});
