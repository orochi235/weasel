/**
 * Property tests of grids: `tileRows` partitions the items, `tileGrid`'s tracks divide evenly and its corners are
 * the items whose boxes touch the grid's corners, and the arrows walk the tiling the way its layout reads.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { rovingGridTarget, tileGrid, tileKey, tileRows, type LastRow } from './grid';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 300;
const count = fc.integer({ min: 0, max: 30 });
const columns = fc.oneof(
  { weight: 6, arbitrary: fc.integer({ min: 1, max: 8 }) },
  { weight: 1, arbitrary: fc.constantFrom(0, -3, 0.5, 2.7, Number.NaN, Infinity, 1e308, Number.MAX_VALUE, 2 ** 53) },
);
const lastRow = fc.constantFrom<LastRow>('start', 'center', 'end', 'fill');
const whole = (c: number): number => (c >= 1 ? Math.min(Math.floor(c), 2 ** 24) : 1);

describe('tileRows', () => {
  it('lists every item once, in reading order, full rows then at most one short one', () => {
    fc.assert(fc.property(count, columns, (n, c) => {
      const rows = tileRows(n, c);
      expect(rows.flat()).toEqual(Array.from({ length: n }, (_, i) => i));
      const across = Math.min(whole(c), n);
      rows.forEach((row, r) => {
        if (r < rows.length - 1) expect(row.length).toBe(across);
        else expect(row.length).toBeGreaterThan(0);
        expect(row.length).toBeLessThanOrEqual(across);
      });
    }), runs(RUNS));
  });
});

describe('tileGrid', () => {
  it('divides its tracks evenly and puts each corner on the item whose box reaches it', () => {
    const t = tally();
    fc.assert(fc.property(count.filter((n) => n > 0), columns, lastRow, (n, c, lr) => {
      const g = tileGrid(n, { columns: c, lastRow: lr });
      const cols = whole(c);
      for (const v of [g.tracks, g.span, g.fillSpan, g.lead]) {
        expect(Number.isFinite(v)).toBe(true);
        expect(Number.isInteger(v)).toBe(true);
      }
      expect(g.span * cols).toBe(g.tracks);
      const rows = tileRows(n, c);
      const last = rows.length - 1;
      expect(g.lastStart).toBe(rows[last]![0]);
      const short = rows[last]!.length < cols;
      if (short && lr === 'fill') expect(g.fillSpan * rows[last]!.length).toBe(g.tracks);
      rows.forEach((row, r) => row.forEach((i, j) => {
        const stretched = short && lr === 'fill' && r === last;
        expect(g.stretched(i)).toBe(stretched);
        const width = stretched ? g.fillSpan : g.span;
        const left = (short && r === last ? g.lead : 0) + j * width;
        const right = left + width;
        expect(left).toBeGreaterThanOrEqual(0);
        expect(right).toBeLessThanOrEqual(g.tracks);
        const want = [
          ...(r === 0 && left === 0 ? ['ss'] : []),
          ...(r === 0 && right === g.tracks ? ['se'] : []),
          ...(r === last && left === 0 ? ['es'] : []),
          ...(r === last && right === g.tracks ? ['ee'] : []),
        ];
        expect(new Set(g.corners(i))).toEqual(new Set(want));
        if (want.length > 0) t.count(`corner:${lr}`);
      }));
      t.count(short ? 'short' : 'full');
    }), runs(RUNS));
    t.atLeast('short', RUNS / 4);
    t.atLeast('full', RUNS / 10);
    for (const lr of ['start', 'center', 'end', 'fill']) t.atLeast(`corner:${lr}`, RUNS / 10);
  }, timeoutFor(RUNS, 2));
});

describe('tileKey and rovingGridTarget', () => {
  const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageDown'];

  it('lands only on an enabled item, Up and Down on another row, the rest in reading order', () => {
    const t = tally();
    fc.assert(fc.property(
      count.filter((n) => n > 0).chain((n) => fc.tuple(
        fc.constant(n), fc.integer({ min: 0, max: n - 1 }),
        fc.array(fc.oneof({ weight: 4, arbitrary: fc.constant(true) }, { weight: 1, arbitrary: fc.constant(false) }), { minLength: n, maxLength: n }),
      )),
      columns, lastRow, fc.constantFrom(...keys), fc.constantFrom('ltr', 'rtl' as const),
      ([n, current, enabled], c, lr, key, dir) => {
        const got = tileKey(current, key, n, { columns: c, lastRow: lr }, { dir, enabled });
        const rows = tileRows(n, c);
        const rowOf = (i: number): number => rows.findIndex((row) => row.includes(i));
        if (got !== null) expect(enabled[got]).toBe(true);
        const on = enabled.flatMap((e, i) => (e ? [i] : []));
        if (key === 'Home') expect(got).toBe(on[0] ?? null);
        else if (key === 'End') expect(got).toBe(on.at(-1) ?? null);
        else if (key === 'ArrowLeft' || key === 'ArrowRight') {
          const forward = (key === 'ArrowRight') !== (dir === 'rtl');
          const ahead = forward ? on.filter((i) => i > current) : on.filter((i) => i < current).reverse();
          expect(got).toBe(ahead[0] ?? (forward ? on[0] : on.at(-1)) ?? null);
          t.count('across');
        } else if (key === 'PageDown') expect(got).toBeNull();
        else {
          const down = key === 'ArrowDown';
          if (got === null) t.count('blocked');
          else {
            expect(down ? rowOf(got) > rowOf(current) : rowOf(got) < rowOf(current)).toBe(true);
            t.count(Math.abs(rowOf(got) - rowOf(current)) > 1 ? 'skipped' : 'vertical');
          }
        }
      },
    ), runs(RUNS));
    t.atLeast('across', RUNS / 5);
    t.atLeast('vertical', RUNS / 10);
    t.atLeast('blocked', RUNS / 10);
    t.atLeast('skipped', 3);
  }, timeoutFor(RUNS, 2));

  it('in rows laid out alike, Up and Down keep the column, and Down then Up comes back', () => {
    const t = tally();
    fc.assert(fc.property(fc.integer({ min: 1, max: 6 }), fc.integer({ min: 1, max: 6 }), fc.nat(), (cols, nRows, pick) => {
      const n = cols * nRows;
      const current = pick % n;
      const all = Array<boolean>(n).fill(true);
      const rows = tileRows(n, cols);
      const down = rovingGridTarget(current, 'ArrowDown', all, rows);
      expect(down).toBe(current + cols < n ? current + cols : null);
      expect(rovingGridTarget(current, 'ArrowUp', all, rows)).toBe(current - cols >= 0 ? current - cols : null);
      if (down !== null) {
        expect(rovingGridTarget(down, 'ArrowUp', all, rows)).toBe(current);
        t.count('round trip');
      }
    }), runs(RUNS));
    t.atLeast('round trip', RUNS / 3);
  });
});

describe('shrunk counterexamples', () => {
  it('an endless column count lays its items out in one row', () => {
    expect(tileRows(1, Infinity)).toEqual([[0]]);
    expect(tileKey(0, 'ArrowRight', 2, { columns: Infinity })).toBe(1);
  });

  it('a column count near the double range keeps whole, finite tracks', () => {
    const g = tileGrid(1, { columns: Number.MAX_VALUE, lastRow: 'start' });
    expect(g.tracks).toBe(2 ** 25);
    expect(tileGrid(3, { columns: Infinity, lastRow: 'fill' }).fillSpan).toBe(2 ** 24);
  });
});
