/**
 * Property tests of how a swatch grid lays its palettes on rings: the rings each palette takes, how thick each is
 * and how far in each lies, and how many fit inside an arc before one would fold.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { arcShape } from '@weasel-js/geom';
import { runs, tally, timeoutFor } from '../../pbt.fixture';
import { ringDepths, ringPlan, ringThicknesses, viableRings } from './ringPlan';

const RUNS = 300;
const rows = fc.array(fc.nat({ max: 6 }), { minLength: 1, maxLength: 6 });

describe('ringPlan', () => {
  it('gives every palette a ring, never more than its rows, and no more in all than the room past one each', () => {
    const t = tally();
    fc.assert(fc.property(rows, fc.nat({ max: 30 }), (rs, room) => {
      const plan = ringPlan(rs, room);
      expect(plan).toHaveLength(rs.length);
      plan.forEach((take, i) => {
        expect(take).toBeGreaterThanOrEqual(1);
        expect(take).toBeLessThanOrEqual(Math.max(1, rs[i]!));
      });
      const sum = plan.reduce((a, b) => a + b, 0);
      expect(sum).toBeLessThanOrEqual(Math.max(room, rs.length));
      const want = rs.reduce((a, n) => a + Math.max(1, n), 0);
      if (room >= want) { t.count('roomy'); expect(plan).toEqual(rs.map((n) => Math.max(1, n))); }
      else if (room >= rs.length) { t.count('short'); expect(sum).toBe(room); }
      else t.count('cramped');
      const more = ringPlan(rs, room + 1);
      plan.forEach((take, i) => expect(more[i]).toBeGreaterThanOrEqual(take));
    }), runs(RUNS));
    for (const k of ['roomy', 'short', 'cramped']) t.atLeast(k, 20);
  }, timeoutFor(RUNS, 1));
});

describe('ringThicknesses and ringDepths', () => {
  it('give one ring per count, a lead widening only its first, and middles a half of each and a gap apart', () => {
    const t = tally();
    fc.assert(fc.property(
      fc.array(fc.nat({ max: 4 }), { minLength: 1, maxLength: 5 }), fc.array(fc.nat({ max: 60 }), { maxLength: 5 }),
      fc.integer({ min: 1, max: 40 }), fc.nat({ max: 10 }),
      (counts, leads, size, gap) => {
        const thick = ringThicknesses(counts, leads, size);
        expect(thick).toHaveLength(counts.reduce((a, b) => a + b, 0));
        let k = 0;
        counts.forEach((n, i) => {
          for (let j = 0; j < n; j++, k++) {
            expect(thick[k]).toBe(j === 0 ? Math.max(size, leads[i] ?? 0) : size);
            if (j === 0 && (leads[i] ?? 0) > size) t.count('lead');
          }
        });
        const depths = ringDepths(thick, gap);
        expect(depths).toHaveLength(thick.length);
        if (depths.length) expect(depths[0]).toBe(0);
        for (let r = 1; r < depths.length; r++) {
          expect(depths[r]! - depths[r - 1]!).toBeCloseTo(thick[r - 1]! / 2 + gap + thick[r]! / 2, 9);
        }
      }), runs(RUNS));
    t.atLeast('lead', 30);
  }, timeoutFor(RUNS, 1));
});

describe('viableRings', () => {
  it('lays ring 0 always, and ring k inside an arc while its radius less the clearance stays above zero', () => {
    const t = tally();
    fc.assert(fc.property(
      fc.integer({ min: 20, max: 300 }), fc.integer({ min: 1, max: 12 }), fc.integer({ min: 1, max: 40 }), fc.nat({ max: 10 }),
      (radius, n, size, gap) => {
        const depths = ringDepths(Array.from({ length: n }, () => size), gap);
        const arc = arcShape({ center: { x: 0, y: 0 }, radius, start: 270, end: 90 });
        const got = viableRings(arc, -1, depths, size, gap);
        const clear = Math.max(size + gap, gap > 0 ? (size * (size + gap)) / (2 * gap) : 0);
        // Away from the fold itself, where shiftTrack's sampling decides.
        fc.pre(depths.every((d) => Math.abs(radius - d - clear) > 1));
        let want = 1;
        while (want < n && radius - depths[want]! - clear > 0) want++;
        expect(got).toBe(want);
        t.count(got === n ? 'all' : got === 1 ? 'one' : 'some');
        expect(viableRings(arc, -1, depths, size + 5, gap)).toBeLessThanOrEqual(got);
      }), runs(RUNS));
    for (const k of ['all', 'one', 'some']) t.atLeast(k, 20);
  }, timeoutFor(RUNS, 5));
});
