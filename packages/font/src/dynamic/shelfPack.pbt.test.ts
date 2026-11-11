import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, tally, timeoutFor } from '../pbt.fixture';
import { ShelfPacker, type ShelfAlloc } from './shelfPack';

const RUNS = 300;
const config = fc.record({ pageSize: fc.integer({ min: 1, max: 64 }), maxPages: fc.integer({ min: 1, max: 4 }) });
const sizes = (pageSize: number) => fc.array(
  fc.tuple(fc.integer({ min: 0, max: pageSize + 2 }), fc.integer({ min: 0, max: pageSize + 2 })),
  { minLength: 1, maxLength: 60 },
);

describe('ShelfPacker, property', () => {
  it('places every rect inside a page and apart from the rest, and places one that fits while pages are left', () => {
    const t = tally();
    fc.assert(fc.property(config.chain((c) => fc.tuple(fc.constant(c), sizes(c.pageSize))), ([{ pageSize, maxPages }, rects]) => {
      const packer = new ShelfPacker(pageSize, maxPages);
      const placed: (ShelfAlloc & { w: number; h: number })[] = [];
      for (const [w, h] of rects) {
        const before = packer.pageCount;
        const fits = packer.fits(w, h);
        expect(fits).toBe(w <= pageSize && h <= pageSize);
        const spot = packer.alloc(w, h);
        if (!fits) expect(spot).toBeNull();
        if (fits && before < maxPages) expect(spot).not.toBeNull();
        expect(packer.pageCount).toBeGreaterThanOrEqual(before);
        expect(packer.pageCount).toBeLessThanOrEqual(maxPages);
        if (!spot) { t.count(fits ? 'full' : 'too big'); continue; }
        t.count('placed');
        expect(spot.page).toBeLessThan(packer.pageCount);
        expect(spot.x).toBeGreaterThanOrEqual(0);
        expect(spot.y).toBeGreaterThanOrEqual(0);
        expect(spot.x + w).toBeLessThanOrEqual(pageSize);
        expect(spot.y + h).toBeLessThanOrEqual(pageSize);
        for (const o of placed) {
          if (o.page !== spot.page) continue;
          const apart = spot.x + w <= o.x || o.x + o.w <= spot.x || spot.y + h <= o.y || o.y + o.h <= spot.y;
          expect(apart).toBe(true);
        }
        placed.push({ ...spot, w, h });
      }
    }), runs(RUNS));
    t.atLeast('placed', 500);
    t.atLeast('full', 50);
    t.atLeast('too big', 50);
  }, timeoutFor(RUNS, 2));
});
