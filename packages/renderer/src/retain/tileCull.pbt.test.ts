import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { checkCull, near, tree } from '../cullTree.fixture';
import { runs, tally, timeoutFor } from '../pbt.fixture';
import { tilesOf } from './contentBounds';
import { boxTree, cullToTile } from './tileCull';

const tile = fc.record({
  x: fc.integer({ min: -400, max: 300 }), y: fc.integer({ min: -400, max: 300 }),
  width: fc.integer({ min: 1, max: 600 }), height: fc.integer({ min: 1, max: 600 }),
});

describe('cullToTile, property', () => {
  it('drops commands without reordering or changing the rest, and keeps every one that paints in the tile', () => {
    const t = tally();
    fc.assert(fc.property(tree, near, tile, fc.constantFrom(1, 2, 0.5), (cmds, m, tl, scale) => {
      const tr = boxTree(cmds, m, scale);
      const out = cullToTile(tr, tl);
      const css = { x: tl.x / scale, y: tl.y / scale, width: tl.width / scale, height: tl.height / scale };
      checkCull(cmds, out, m, css, scale, t);
      expect(cullToTile(boxTree(out, m, scale), tl)).toBe(out);
    }), runs(1000));
    t.atLeast('leaf must stay', 25);
    t.atLeast('moved leaf must stay', 25);
    t.atLeast('dropped', 200);
  }, timeoutFor(1000, 10));

  it('keeps every command in some tile of a rect cut into tiles, when it paints in the rect', () => {
    fc.assert(fc.property(tree, near, tile, fc.integer({ min: 1, max: 8 }), (cmds, m, rect, cuts) => {
      const side = Math.ceil(Math.max(rect.width, rect.height) / cuts);
      const tr = boxTree(cmds, m, 1);
      const kept = new Set(tilesOf(rect, side).flatMap((tl) => cullToTile(tr, tl)).map((c) => (c as { pbt?: number }).pbt));
      const whole = cullToTile(tr, rect).map((c) => (c as { pbt?: number }).pbt);
      for (const id of whole) expect(kept.has(id), `command ${id} in the rect but in no tile`).toBe(true);
    }), runs(300));
  }, timeoutFor(300, 10));
});

describe('tilesOf, property', () => {
  it('cuts a rect into tiles no larger than the side that cover it once', () => {
    fc.assert(fc.property(tile, fc.integer({ min: 1, max: 12 }), fc.integer({ min: 0, max: 40 }), (rect, cuts, extra) => {
      const side = Math.ceil(Math.max(rect.width, rect.height) / cuts) + extra;
      const tiles = tilesOf(rect, side);
      let area = 0;
      for (const [i, a] of tiles.entries()) {
        expect(a.width).toBeGreaterThan(0);
        expect(a.height).toBeGreaterThan(0);
        expect(a.width).toBeLessThanOrEqual(side);
        expect(a.height).toBeLessThanOrEqual(side);
        expect(a.x >= rect.x && a.y >= rect.y && a.x + a.width <= rect.x + rect.width && a.y + a.height <= rect.y + rect.height).toBe(true);
        for (const b of tiles.slice(i + 1)) {
          const apart = a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
          expect(apart, 'tiles overlap').toBe(true);
        }
        area += a.width * a.height;
      }
      expect(area).toBe(rect.width * rect.height);
    }), runs(300));
  });
});
