import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { coord, eighth, pitch, posEighth, runs, tally, timeoutFor } from '../pbt.fixture';
import { cellOf, linesIn, linesNear, mapLines, nearestLine, resolveGridLines, type AxisLines } from './axes';
import { roundToCell } from './roundToCell';

const RUNS = runs(300);
const TIMEOUT = timeoutFor(300, 2);
type Periodic = Extract<AxisLines, { pitch: number }>;

const near = (a: number, b: number, scale = 1): boolean => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b), scale);

/** A pitch's axis on the eighth lattice, so its lines are exact; limited to a range or not. */
const exactAxis: fc.Arbitrary<Periodic> = fc
  .record({ pitch: posEighth(20), offset: eighth(100), limited: fc.boolean(), a: eighth(300), b: eighth(300) })
  .map(({ pitch, offset, limited, a, b }) => ({
    pitch, offset, from: limited ? Math.min(a, b) : -Infinity, to: limited ? Math.max(a, b) : Infinity,
  }));

/** Any pitch's axis, unlimited. */
const anyAxis: fc.Arbitrary<Periodic> = fc
  .record({ pitch, offset: coord(1000) })
  .map(({ pitch, offset }) => ({ pitch, offset, from: -Infinity, to: Infinity }));

/** Explicit lines, unsorted with repeats, as a caller writes them. */
const explicit = fc.array(eighth(200), { minLength: 1, maxLength: 12 });

/** Every line of `a` within `reach` of `v`, by walking indices: the oracle `linesNear` answers from. */
function brute(a: Periodic, v: number, reach: number): number[] {
  const out: number[] = [];
  const k0 = Math.floor((v - reach - a.offset) / a.pitch) - 1;
  for (let k = k0; k <= k0 + Math.ceil((2 * reach) / a.pitch) + 2; k++) {
    const p = a.offset + k * a.pitch;
    if (p >= a.from && p <= a.to) out.push(p);
  }
  return out;
}

describe('grid axes, property', () => {
  it('linesNear answers the nearest line first, the upper on a tie, and a line either side inside the range', () => {
    const t = tally();
    // Half the points sit midway between two lines, so ties come up.
    const axisAndPoint = exactAxis.chain((a) => fc.tuple(fc.constant(a), fc.oneof(
      eighth(400), fc.integer({ min: -20, max: 20 }).map((k) => a.offset + (k + 0.5) * a.pitch),
    )));
    fc.assert(fc.property(axisAndPoint, ([a, v]) => {
      const got = linesNear(a, v);
      const all = brute(a, v, a.pitch * 3 + 1000);
      if (all.length === 0) {
        expect(got).toEqual([]);
        return;
      }
      t.count(all.length === 1 ? 'one line' : 'lines');
      expect(got.length).toBe(Math.min(2, all.length));
      for (const l of got) expect(all).toContain(l);
      const best = Math.min(...all.map((l) => Math.abs(l - v)));
      expect(Math.abs(got[0]! - v)).toBe(best);
      const tied = all.filter((l) => Math.abs(l - v) === best);
      expect(got[0]).toBe(Math.max(...tied));
      if (tied.length > 1) t.count('tie');
      if (got.length === 2 && v > all[0]! && v < all[all.length - 1]!) {
        t.count('inside');
        expect(Math.min(...got) <= v && v <= Math.max(...got)).toBe(true);
        expect(Math.abs(got[1]! - got[0]!)).toBe(a.pitch);
      }
    }), RUNS);
    t.atLeast('lines', 50);
    t.atLeast('one line', 1);
    t.atLeast('tie', 3);
    t.atLeast('inside', 30);
  }, TIMEOUT);

  it('nearestLine is idempotent, and moves a value no farther than half a pitch', () => {
    fc.assert(fc.property(anyAxis, coord(1e4), (a, v) => {
      const n = nearestLine(a, v)!;
      expect(Math.abs(n - v)).toBeLessThanOrEqual(a.pitch / 2 + 1e-9 * Math.max(1, Math.abs(v)));
      expect(near(nearestLine(a, n)!, n, a.pitch)).toBe(true);
    }), RUNS);
  }, TIMEOUT);

  it('a whole pitch of translation carries the nearest line along with it', () => {
    fc.assert(fc.property(exactAxis.map((a) => ({ ...a, from: -Infinity, to: Infinity })), eighth(400), fc.integer({ min: -50, max: 50 }), (a, v, k) => {
      expect(nearestLine(a, v + k * a.pitch)).toBe(nearestLine(a, v)! + k * a.pitch);
      expect(nearestLine({ ...a, offset: a.offset + k * a.pitch }, v)).toBe(nearestLine(a, v));
    }), RUNS);
  }, TIMEOUT);

  it('linesIn gives every line of the range in order, a pitch apart, and none beyond it', () => {
    const t = tally();
    fc.assert(fc.property(exactAxis, eighth(300), posEighth(300), (a, lo, len) => {
      const hi = lo + len;
      const got = linesIn(a, lo, hi);
      const want = brute(a, (lo + hi) / 2, len / 2 + a.pitch).filter((p) => p >= lo && p <= hi);
      expect(got).toEqual(want);
      if (got.length > 1) t.count('several');
    }), RUNS);
    t.atLeast('several', 50);
  }, TIMEOUT);

  it('subdivision levels nest: every line of a pitch is a line of that pitch cut in n', () => {
    fc.assert(fc.property(posEighth(5), fc.integer({ min: 2, max: 10 }), eighth(50), eighth(200), (fine, n, offset, lo) => {
      const coarse: Periodic = { pitch: fine * n, offset, from: -Infinity, to: Infinity };
      const sub = linesIn({ ...coarse, pitch: fine }, lo, lo + 200);
      for (const l of linesIn(coarse, lo, lo + 200)) expect(sub).toContain(l);
    }), RUNS);
  }, TIMEOUT);

  it('cellOf answers the cell holding a value, between two adjacent lines', () => {
    const t = tally();
    fc.assert(fc.property(exactAxis, eighth(400), (a, v) => {
      const c = cellOf(a, v);
      const all = brute(a, v, 2 * a.pitch);
      const inside = all.some((l) => l <= v) && all.some((l) => l > v);
      if (!inside) {
        expect(c).toBeNull();
        t.count('outside');
        return;
      }
      t.count('inside');
      expect(c).not.toBeNull();
      expect(c!.lo <= v && v < c!.hi).toBe(true);
      expect(c!.hi - c!.lo).toBe(a.pitch);
      expect(c!.lo).toBe(a.offset + c!.index * a.pitch);
      expect(all).toContain(c!.lo);
      expect(all).toContain(c!.hi);
    }), RUNS);
    t.atLeast('inside', 50);
    t.atLeast('outside', 5);
  }, TIMEOUT);

  it('explicit lines resolve sorted and once each, and cellOf and linesNear read them', () => {
    fc.assert(fc.property(explicit, eighth(250), (at, v) => {
      const lines = resolveGridLines({ x: { at } }, (l) => l as number).x!;
      if (!('at' in lines)) throw new Error('expected explicit lines');
      const want = [...new Set(at)].sort((p, q) => p - q);
      expect(lines.at).toEqual(want);
      const c = cellOf(lines, v);
      const i = want.filter((l) => l <= v).length - 1;
      if (i >= 0 && i < want.length - 1) expect(c).toEqual({ index: i, lo: want[i], hi: want[i + 1] });
      else expect(c).toBeNull();
      const pair = linesNear(lines, v);
      const best = Math.min(...want.map((l) => Math.abs(l - v)));
      expect(Math.abs(pair[0]! - v)).toBe(best);
    }), RUNS);
  }, TIMEOUT);

  it('mapLines moves every line as it moves a point', () => {
    const t = tally();
    fc.assert(fc.property(
      fc.oneof(exactAxis, explicit.map((at) => ({ at: [...new Set(at)].sort((p, q) => p - q) }) as AxisLines)),
      fc.oneof(fc.double({ min: 0.01, max: 100, noNaN: true }), fc.double({ min: -100, max: -0.01, noNaN: true })),
      coord(500), eighth(200), posEighth(200),
      (a, s, shift, lo, len) => {
        const m = (p: number) => p * s + shift;
        const want = linesIn(a, lo, lo + len).map(m).sort((p, q) => p - q);
        const [mlo, mhi] = [m(lo), m(lo + len)].sort((p, q) => p - q) as [number, number];
        const mapped = mapLines(a, s, shift);
        // Ends one rounding off may fall either side of the window, so compare the lines both hold.
        const slack = 1e-9 * Math.max(1, Math.abs(mlo), Math.abs(mhi));
        const got = linesIn(mapped, mlo - slack, mhi + slack);
        const inner = (p: number) => p > mlo + 2 * slack && p < mhi - 2 * slack;
        const g = got.filter(inner);
        const w = want.filter(inner);
        expect(g.length).toBe(w.length);
        g.forEach((p, i) => expect(near(p, w[i]!, Math.abs(shift) + Math.abs(s) * 1000)).toBe(true));
        if (w.length > 0) t.count(s < 0 ? 'flipped' : 'kept');
      },
    ), RUNS);
    t.atLeast('flipped', 20);
    t.atLeast('kept', 20);
  }, TIMEOUT);

  it('roundToCell is idempotent, lands on a multiple within half a cell, and never answers -0', () => {
    fc.assert(fc.property(coord(1e4), fc.double({ min: 1e-3, max: 1e3, noNaN: true }), (v, cell) => {
      const r = roundToCell(v, cell);
      expect(Object.is(r, -0)).toBe(false);
      expect(Math.abs(r - v)).toBeLessThanOrEqual(cell / 2 + 1e-9 * Math.max(1, Math.abs(v)));
      expect(near(roundToCell(r, cell), r, cell)).toBe(true);
    }), RUNS);
  }, TIMEOUT);
});
