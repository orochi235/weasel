/**
 * Property tests of menu placement on whole-pixel layouts: a menu, a submenu, and a button's menu land inside the
 * viewport whenever they fit in it, on any anchor, row, or button, the ones past an edge included; each takes its
 * first side whenever that side fits; a menu larger than the viewport pins to its near edge; and `'rtl'` places
 * as `'ltr'` does in a mirrored viewport.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { placeMenu, placeMenuUnder, placeSubmenu, type MenuDirection, type MenuSide, type Point, type Rect, type Size } from './placement';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 500;

const bounds: fc.Arbitrary<Rect> = fc.record({ x: fc.integer({ min: -200, max: 200 }), y: fc.integer({ min: -200, max: 200 }), w: fc.integer({ min: 0, max: 800 }), h: fc.integer({ min: 0, max: 600 }) });
const size: fc.Arbitrary<Size> = fc.record({ w: fc.integer({ min: 0, max: 900 }), h: fc.integer({ min: 0, max: 700 }) });
const point: fc.Arbitrary<Point> = fc.record({ x: fc.integer({ min: -400, max: 1200 }), y: fc.integer({ min: -400, max: 1000 }) });
const rect: fc.Arbitrary<Rect> = fc.record({ x: fc.integer({ min: -400, max: 1200 }), y: fc.integer({ min: -400, max: 1000 }), w: fc.integer({ min: 0, max: 300 }), h: fc.integer({ min: 0, max: 60 }) });
const small: fc.Arbitrary<Size> = fc.record({ w: fc.integer({ min: 0, max: 300 }), h: fc.integer({ min: 0, max: 200 }) });
const dir = fc.constantFrom<MenuDirection>('ltr', 'rtl');
const side = fc.constantFrom<MenuSide>('top', 'bottom', 'left', 'right');

/** Check `p` keeps a menu of `s` inside `b` on each axis it fits, and at the near edge on one it does not. Which
 *  edge an rtl menu too wide for the viewport favors is open (docs/unruled.md). */
function inside(p: Point, s: Size, b: Rect, d: MenuDirection, t: ReturnType<typeof tally>): void {
  if (s.w <= b.w) {
    expect(p.x).toBeGreaterThanOrEqual(b.x);
    expect(p.x + s.w).toBeLessThanOrEqual(b.x + b.w);
    t.count('fits x');
  } else if (d === 'ltr') expect(p.x).toBe(b.x);
  if (s.h <= b.h) {
    expect(p.y).toBeGreaterThanOrEqual(b.y);
    expect(p.y + s.h).toBeLessThanOrEqual(b.y + b.h);
    t.count('fits y');
  } else expect(p.y).toBe(b.y);
}

const mirrorRect = (r: Rect): Rect => ({ ...r, x: -(r.x + r.w) });

describe('placeMenu', () => {
  it('stays inside the viewport, opens down and forward where that fits, and mirrors under rtl', () => {
    const t = tally();
    fc.assert(fc.property(size, point, bounds, dir, (s, a, b, d) => {
      const p = placeMenu(s, a, b, d);
      inside(p, s, b, d, t);
      const forward = d === 'ltr' ? a.x >= b.x && a.x + s.w <= b.x + b.w : a.x <= b.x + b.w && a.x - s.w >= b.x;
      if (forward) { expect(p.x).toBe(d === 'ltr' ? a.x : a.x - s.w); t.count('forward'); }
      if (a.y >= b.y && a.y + s.h <= b.y + b.h) expect(p.y).toBe(a.y);
      // Which edge an rtl menu favors when it fits on neither side is open (docs/unruled.md).
      const either = a.x - s.w >= b.x && a.x <= b.x + b.w || a.x >= b.x && a.x + s.w <= b.x + b.w;
      if (either) expect(-(placeMenu(s, { x: -a.x, y: a.y }, mirrorRect(b), d === 'ltr' ? 'rtl' : 'ltr').x + s.w) + 0).toBe(p.x + 0);
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
      const after = row.x + row.w;
      const forward = d === 'ltr' ? after >= b.x && after + s.w <= b.x + b.w : row.x <= b.x + b.w && row.x - s.w >= b.x;
      if (forward) { expect(p.x).toBe(d === 'ltr' ? after : row.x - s.w); t.count('forward'); }
      if (row.y >= b.y && row.y + s.h <= b.y + b.h) expect(p.y).toBe(row.y);
      const either = row.x - s.w >= b.x && row.x <= b.x + b.w || after >= b.x && after + s.w <= b.x + b.w;
      if (either) expect(-(placeSubmenu(s, mirrorRect(row), mirrorRect(b), d === 'ltr' ? 'rtl' : 'ltr').x + s.w) + 0).toBe(p.x + 0);
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
      const lo = { x: b.x, y: b.y }, hi = { x: b.x + b.w, y: b.y + b.h };
      const fits = sd === 'bottom' ? under.y + under.h >= lo.y && under.y + under.h + s.h <= hi.y
        : sd === 'top' ? under.y <= hi.y && under.y - s.h >= lo.y
          : sd === 'right' ? under.x + under.w >= lo.x && under.x + under.w + s.w <= hi.x
            : under.x <= hi.x && under.x - s.w >= lo.x;
      if (fits) {
        t.count(`on ${sd}`);
        if (sd === 'bottom') expect(p.y).toBe(under.y + under.h);
        if (sd === 'top') expect(p.y).toBe(under.y - s.h);
        if (sd === 'right') expect(p.x).toBe(under.x + under.w);
        if (sd === 'left') expect(p.x).toBe(under.x - s.w);
      }
    }), runs(RUNS));
    t.atLeast('fits x', RUNS / 6);
    t.atLeast('fits y', RUNS / 6);
    for (const sd of ['top', 'bottom', 'left', 'right']) t.atLeast(`on ${sd}`, RUNS / 100);
  }, timeoutFor(RUNS, 1));
});
