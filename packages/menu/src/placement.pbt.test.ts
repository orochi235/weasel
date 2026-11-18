/**
 * Property tests of menu placement on whole-pixel layouts: a menu, a submenu, and a button's menu land inside the
 * viewport whenever they fit in it, on any anchor, row, or button, the ones past an edge included; each takes its
 * first side whenever that side fits; a menu larger than the viewport pins to its near edge; and `'rtl'` places
 * as `'ltr'` does in a mirrored viewport.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { placeMenu, placeMenuUnder, placeSubmenu, type MenuDirection, type MenuSide, type Point, type MenuRect, type MenuSize } from './placement';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 500;

const bounds: fc.Arbitrary<MenuRect> = fc.record({ x: fc.integer({ min: -200, max: 200 }), y: fc.integer({ min: -200, max: 200 }), width: fc.integer({ min: 0, max: 800 }), height: fc.integer({ min: 0, max: 600 }) });
const size: fc.Arbitrary<MenuSize> = fc.record({ width: fc.integer({ min: 0, max: 900 }), height: fc.integer({ min: 0, max: 700 }) });
const point: fc.Arbitrary<Point> = fc.record({ x: fc.integer({ min: -400, max: 1200 }), y: fc.integer({ min: -400, max: 1000 }) });
const rect: fc.Arbitrary<MenuRect> = fc.record({ x: fc.integer({ min: -400, max: 1200 }), y: fc.integer({ min: -400, max: 1000 }), width: fc.integer({ min: 0, max: 300 }), height: fc.integer({ min: 0, max: 60 }) });
const small: fc.Arbitrary<MenuSize> = fc.record({ width: fc.integer({ min: 0, max: 300 }), height: fc.integer({ min: 0, max: 200 }) });
const dir = fc.constantFrom<MenuDirection>('ltr', 'rtl');
const side = fc.constantFrom<MenuSide>('top', 'bottom', 'left', 'right');

/** Check `p` keeps a menu of `s` inside `b` on each axis it fits, and at the near edge on one it does not. Which
 *  edge an rtl menu too wide for the viewport favors is open (docs/unruled.md). */
function inside(p: Point, s: MenuSize, b: MenuRect, d: MenuDirection, t: ReturnType<typeof tally>): void {
  if (s.width <= b.width) {
    expect(p.x).toBeGreaterThanOrEqual(b.x);
    expect(p.x + s.width).toBeLessThanOrEqual(b.x + b.width);
    t.count('fits x');
  } else if (d === 'ltr') expect(p.x).toBe(b.x);
  if (s.height <= b.height) {
    expect(p.y).toBeGreaterThanOrEqual(b.y);
    expect(p.y + s.height).toBeLessThanOrEqual(b.y + b.height);
    t.count('fits y');
  } else expect(p.y).toBe(b.y);
}

const mirrorRect = (r: MenuRect): MenuRect => ({ ...r, x: -(r.x + r.width) });

describe('placeMenu', () => {
  it('stays inside the viewport, opens down and forward where that fits, and mirrors under rtl', () => {
    const t = tally();
    fc.assert(fc.property(size, point, bounds, dir, (s, a, b, d) => {
      const p = placeMenu(s, a, b, d);
      inside(p, s, b, d, t);
      const forward = d === 'ltr' ? a.x >= b.x && a.x + s.width <= b.x + b.width : a.x <= b.x + b.width && a.x - s.width >= b.x;
      if (forward) { expect(p.x).toBe(d === 'ltr' ? a.x : a.x - s.width); t.count('forward'); }
      if (a.y >= b.y && a.y + s.height <= b.y + b.height) expect(p.y).toBe(a.y);
      // Which edge an rtl menu favors when it fits on neither side is open (docs/unruled.md).
      const either = a.x - s.width >= b.x && a.x <= b.x + b.width || a.x >= b.x && a.x + s.width <= b.x + b.width;
      if (either) expect(-(placeMenu(s, { x: -a.x, y: a.y }, mirrorRect(b), d === 'ltr' ? 'rtl' : 'ltr').x + s.width) + 0).toBe(p.x + 0);
    }), runs(RUNS));
    t.atLeast('fits x', RUNS / 6);
    t.atLeast('fits y', RUNS / 6);
    t.atLeast('forward', RUNS / 25);
  }, timeoutFor(RUNS, 1));
});

describe('placeSubmenu', () => {
  it('stays inside the viewport, opens beside its row on the forward side where that fits, and mirrors under rtl', () => {
    const t = tally();
    fc.assert(fc.property(size, rect, bounds, dir, (s, row, b, d) => {
      const p = placeSubmenu(s, row, b, d);
      inside(p, s, b, d, t);
      const after = row.x + row.width;
      const forward = d === 'ltr' ? after >= b.x && after + s.width <= b.x + b.width : row.x <= b.x + b.width && row.x - s.width >= b.x;
      if (forward) { expect(p.x).toBe(d === 'ltr' ? after : row.x - s.width); t.count('forward'); }
      if (row.y >= b.y && row.y + s.height <= b.y + b.height) expect(p.y).toBe(row.y);
      const either = row.x - s.width >= b.x && row.x <= b.x + b.width || after >= b.x && after + s.width <= b.x + b.width;
      if (either) expect(-(placeSubmenu(s, mirrorRect(row), mirrorRect(b), d === 'ltr' ? 'rtl' : 'ltr').x + s.width) + 0).toBe(p.x + 0);
    }), runs(RUNS));
    t.atLeast('fits x', RUNS / 6);
    t.atLeast('forward', RUNS / 25);
  }, timeoutFor(RUNS, 1));
});

describe('placeMenuUnder', () => {
  it('stays inside the viewport, on its side of the button where that fits', () => {
    const t = tally();
    fc.assert(fc.property(fc.oneof(size, small), rect, bounds, side, dir, (s, under, b, sd, d) => {
      const p = placeMenuUnder(s, under, b, sd, d);
      inside(p, s, b, d, t);
      const lo = { x: b.x, y: b.y }, hi = { x: b.x + b.width, y: b.y + b.height };
      const fits = sd === 'bottom' ? under.y + under.height >= lo.y && under.y + under.height + s.height <= hi.y
        : sd === 'top' ? under.y <= hi.y && under.y - s.height >= lo.y
          : sd === 'right' ? under.x + under.width >= lo.x && under.x + under.width + s.width <= hi.x
            : under.x <= hi.x && under.x - s.width >= lo.x;
      if (fits) {
        t.count(`on ${sd}`);
        if (sd === 'bottom') expect(p.y).toBe(under.y + under.height);
        if (sd === 'top') expect(p.y).toBe(under.y - s.height);
        if (sd === 'right') expect(p.x).toBe(under.x + under.width);
        if (sd === 'left') expect(p.x).toBe(under.x - s.width);
      }
    }), runs(RUNS));
    t.atLeast('fits x', RUNS / 6);
    t.atLeast('fits y', RUNS / 6);
    for (const sd of ['top', 'bottom', 'left', 'right']) t.atLeast(`on ${sd}`, RUNS / 100);
  }, timeoutFor(RUNS, 1));
});
