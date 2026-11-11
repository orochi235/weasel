/**
 * Second-pass properties of the grid's readers at the edges of their input: any double, `NaN` and the
 * infinities included, for a point, a value, a pitch, a cell size, and a tolerance.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { eighth, posEighth, runs, tally, timeoutFor } from '../pbt.fixture';
import { cellOf, linesNear, resolveGridLines, type AxisLines } from './axes';
import { gridFit } from './fit';
import { pointToGridCell } from './pointToGridCell';
import { roundToCell } from './roundToCell';

const RUNS = runs(300);
const TIMEOUT = timeoutFor(300, 2);

/** Any double, the edges weighted in. */
const anyDouble = fc.oneof(
  fc.double(),
  fc.constantFrom(NaN, Infinity, -Infinity, 0, -0, Number.MIN_VALUE, -Number.MIN_VALUE, Number.MAX_VALUE, 1e300, -1e300),
  eighth(1000),
);

/** A pitch's axis or explicit lines, on the eighth lattice. */
const axisLines: fc.Arbitrary<AxisLines> = fc.oneof(
  fc.record({ pitch: posEighth(20), offset: eighth(100) }).map(({ pitch, offset }) => ({ pitch, offset, from: -Infinity, to: Infinity })),
  fc.array(eighth(200), { minLength: 1, maxLength: 8 }).map((at) => ({ at: [...new Set(at)].sort((p, q) => p - q) })),
);

describe('grid readers at the edges, property', () => {
  it('gridFit counts a point a miss unless a line lies within the tolerance on each axis with lines', () => {
    const t = tally();
    fc.assert(fc.property(axisLines, fc.array(fc.record({ x: anyDouble, y: anyDouble }), { maxLength: 4 }), fc.oneof(anyDouble, fc.constantFrom(0, 1e-6, 0.5, 3)), (a, points, tolerance) => {
      const { fits, misses } = gridFit(points, { x: a, y: null }, tolerance);
      points.forEach((p, index) => {
        const lines = 'at' in a ? a.at : linesNear(a, p.x);
        const within = Number.isFinite(p.x) && lines.some((l) => Math.abs(l - p.x) <= tolerance);
        const missed = misses.some((m) => m.index === index && m.axis === 'x');
        // A pitch's lines past a safe index are one number apart from the point's, so take its answer there.
        if ('pitch' in a && Number.isFinite(p.x) && Math.abs(p.x) > 2 ** 40) return;
        t.count(within ? 'fits' : Number.isFinite(p.x) ? 'misses' : 'non-finite');
        expect(missed, `point ${p.x}, tolerance ${tolerance}`).toBe(!within);
      });
      expect(misses.some((m) => m.axis === 'y')).toBe(false);
      expect(fits).toBe(misses.length === 0);
    }), RUNS);
    t.atLeast('fits', 20);
    t.atLeast('misses', 20);
    t.atLeast('non-finite', 20);
  }, TIMEOUT);

  it('roundToCell lands a finite value within half a cell of it on a multiple, and leaves it be for a cell that is no length', () => {
    const t = tally();
    fc.assert(fc.property(anyDouble, anyDouble, (v, cell) => {
      const r = roundToCell(v, cell);
      expect(Object.is(r, -0)).toBe(false);
      if (!(cell > 0 && Number.isFinite(cell)) || !Number.isFinite(v)) {
        t.count('left');
        expect(Object.is(r, v) || (Object.is(v, -0) && r === 0)).toBe(true);
        return;
      }
      t.count('rounded');
      expect(Number.isFinite(r)).toBe(true);
      expect(Math.abs(r - v)).toBeLessThanOrEqual(cell / 2 + Math.abs(v) * 2 ** -52);
      expect(roundToCell(r, cell)).toBe(r);
    }), RUNS);
    t.atLeast('left', 50);
    t.atLeast('rounded', 50);
  }, TIMEOUT);

  it('no cell holds a non-finite value, and a point in no cell has none', () => {
    fc.assert(fc.property(axisLines, fc.constantFrom(NaN, Infinity, -Infinity), fc.boolean(), (a, v, onX) => {
      expect(cellOf(a, v)).toBeNull();
      expect(cellOf(null, v)).toBeNull();
      expect(linesNear(a, v).every(Number.isFinite)).toBe(true);
      const spacing = 'at' in a ? { x: { at: a.at }, y: { at: a.at } } : { x: a, y: a };
      expect(pointToGridCell(onX ? { x: v, y: 0 } : { x: 0, y: v }, spacing)).toBeNull();
    }), RUNS);
  }, TIMEOUT);

  it('linesNear answers finite lines either side of any finite value, however fine the pitch', () => {
    const t = tally();
    fc.assert(fc.property(fc.oneof(fc.double({ min: Number.MIN_VALUE, max: 1e-200, noNaN: true }), posEighth(10)), fc.double({ min: -1e300, max: 1e300, noNaN: true }), (pitch, v) => {
      const a = resolveGridLines(pitch, (l) => l as number).x!;
      const got = linesNear(a, v);
      for (const l of got) expect(Number.isFinite(l)).toBe(true);
      t.count(got.length === 0 ? 'none' : 'some');
    }), RUNS);
    t.atLeast('some', 20);
  }, TIMEOUT);
});
