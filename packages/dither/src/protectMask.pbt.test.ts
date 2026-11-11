/**
 * Property tests of protection: `protectMask` against a per-pixel model of rects rounded outward and clipped, edges
 * past the double range read at their limit; and `protectRects` mapping document rects into dot space and back.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Rect } from '@weasel-js/geom';
import { protectMask } from './protectMask';
import { protectRects } from './protectRects';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 300;

const edge = fc.oneof(
  { weight: 6, arbitrary: fc.double({ min: -6, max: 20, noNaN: true }) },
  { weight: 2, arbitrary: fc.integer({ min: -4, max: 18 }) },
  { weight: 1, arbitrary: fc.constantFrom(-Infinity, Infinity, Number.NaN, -1e308, 1e308, Number.MAX_VALUE) },
);
const extent = fc.oneof(
  { weight: 6, arbitrary: fc.double({ min: -2, max: 16, noNaN: true }) },
  { weight: 2, arbitrary: fc.integer({ min: 0, max: 12 }) },
  { weight: 1, arbitrary: fc.constantFrom(Infinity, -Infinity, Number.NaN, 1e308, Number.MAX_VALUE) },
);
/** A span from far out to far out, as a fine grid maps a large document rect. */
const span = fc.tuple(fc.constantFrom(-Infinity, -1e308, -Number.MAX_VALUE, -3), fc.constantFrom(Infinity, Number.MAX_VALUE, 1e308));
const rect: fc.Arbitrary<Rect> = fc.oneof(
  { weight: 4, arbitrary: fc.record({ x: edge, y: edge, width: extent, height: extent }) },
  { weight: 1, arbitrary: fc.tuple(span, fc.option(span, { nil: null }), edge, extent).map(([[x, width], other, y, height]) => (other ? { x, width, y: other[0], height: other[1] } : { x, width, y, height })) },
);

/** Where a rect's far edge lies along one axis: its end at the limit when it runs on to infinity from anywhere short of it. */
const far = (at: number, size: number) => (size === Infinity && at < Infinity ? Infinity : at + size);

/** Whether pixel `(px, py)` lies in `r` rounded outward to whole pixels. */
function covers(r: Rect, px: number, py: number): boolean {
  return px >= Math.floor(r.x) && px < Math.ceil(far(r.x, r.width)) && py >= Math.floor(r.y) && py < Math.ceil(far(r.y, r.height));
}

describe('protectMask', () => {
  it('protects exactly the pixels some rect covers once rounded outward, and none outside the image', () => {
    const t = tally();
    fc.assert(fc.property(fc.array(rect, { maxLength: 4 }), fc.integer({ min: 0, max: 14 }), fc.integer({ min: 0, max: 14 }), (rects, w, h) => {
      const mask = protectMask(rects, w, h);
      expect(mask).toHaveLength(w * h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const want = rects.some((r) => covers(r, x, y));
          expect(mask[y * w + x]).toBe(want ? 1 : 0);
          if (want) t.count('protected');
        }
      }
      if (rects.some((r) => !Number.isFinite(r.x + r.width) || !Number.isFinite(r.y + r.height))) t.count('unbounded');
    }), runs(RUNS));
    t.atLeast('protected', 500);
    t.atLeast('unbounded', 30);
  }, timeoutFor(RUNS, 2));
});

describe('protectRects', () => {
  it("maps each item's rect into dot space, one unit a dot from the grid's origin, and skips an item it leaves out", () => {
    const doc = fc.record({ x: fc.double({ min: -1e4, max: 1e4, noNaN: true }), y: fc.double({ min: -1e4, max: 1e4, noNaN: true }), width: fc.double({ min: 0, max: 1e4, noNaN: true }), height: fc.double({ min: 0, max: 1e4, noNaN: true }) });
    const grid = fc.record({ pitch: fc.double({ min: 1e-3, max: 100, noNaN: true }), origin: fc.record({ x: fc.double({ min: -1e3, max: 1e3, noNaN: true }), y: fc.double({ min: -1e3, max: 1e3, noNaN: true }) }) });
    fc.assert(fc.property(fc.array(fc.oneof(doc, fc.constantFrom(false as const, null)), { maxLength: 6 }), grid, (items, g) => {
      const out = protectRects(items, (r) => r, g);
      const kept = items.filter((r): r is Rect => !!r);
      expect(out).toHaveLength(kept.length);
      out.forEach((d, i) => {
        const r = kept[i]!;
        const tol = 1e-9 * Math.max(1, Math.abs(r.x), Math.abs(r.y), r.width, r.height, Math.abs(g.origin.x), Math.abs(g.origin.y));
        expect(Math.abs(d.x * g.pitch + g.origin.x - r.x)).toBeLessThanOrEqual(tol);
        expect(Math.abs(d.y * g.pitch + g.origin.y - r.y)).toBeLessThanOrEqual(tol);
        expect(Math.abs(d.width * g.pitch - r.width)).toBeLessThanOrEqual(tol);
        expect(Math.abs(d.height * g.pitch - r.height)).toBeLessThanOrEqual(tol);
      });
    }), runs(RUNS));
  });
});
