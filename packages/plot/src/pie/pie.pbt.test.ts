/** A pie's angles: a full turn cut in order, each slice its value's share of it, whatever the values. */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { measure, pieData, runs, tally, timeoutFor } from '../pbt.fixture';
import { PLOT_THEME } from '../theme';
import { compilePie, pieAngles, pieValueText } from './compile';
import { pieValueOf } from './edit';

const RUNS = 400;
const TURN = 2 * Math.PI;

describe('pieAngles', () => {
  it('cuts one full turn from twelve o\'clock in slice order, each slice its share, and nothing for no value', () => {
    const seen = tally();
    fc.assert(fc.property(pieData, (data) => {
      const angles = pieAngles(data);
      expect(angles).toHaveLength(data.slices.length);
      const counted = data.slices.map((s) => (Number.isFinite(s.value) && s.value > 0 ? s.value : 0));
      const largest = Math.max(0, ...counted);
      angles.forEach((a, i) => {
        expect(a.start).toBe(i === 0 ? 0 : angles[i - 1]!.end);
        expect(a.end).toBeGreaterThanOrEqual(a.start);
        if (counted[i] === 0) expect(a.end).toBe(a.start);
      });
      if (largest === 0) {
        seen.count('empty');
        for (const a of angles) expect(a).toEqual({ start: 0, end: 0 });
        return;
      }
      seen.count('cut');
      expect(Math.abs(angles.at(-1)!.end - TURN)).toBeLessThanOrEqual(1e-9);
      // Shares compared over the largest value, so a sum past the double range still compares.
      const total = counted.reduce((sum, v) => sum + v / largest, 0);
      angles.forEach((a, i) => {
        expect(Math.abs((a.end - a.start) - TURN * (counted[i]! / largest / total))).toBeLessThanOrEqual(1e-9);
      });
    }), runs(RUNS));
    seen.atLeast('cut', RUNS / 4);
    seen.atLeast('empty', RUNS / 40);
  }, timeoutFor(RUNS, 1));

  it('lays each slice out at its angles, a circle inside the box', () => {
    const seen = tally();
    fc.assert(fc.property(pieData, fc.integer({ min: 0, max: 1500 }), fc.integer({ min: 0, max: 1500 }), (data, width, height) => {
      const { layout, marks } = compilePie(data, { width, height }, PLOT_THEME, measure);
      expect(layout.angles).toEqual(pieAngles(data));
      expect(layout.radius).toBeGreaterThanOrEqual(0);
      if (layout.radius >= 1) {
        seen.count('drawn');
        expect(layout.center.x - layout.radius).toBeGreaterThanOrEqual(-1e-9);
        expect(layout.center.y - layout.radius).toBeGreaterThanOrEqual(-1e-9);
        expect(layout.center.x + layout.radius).toBeLessThanOrEqual(width + 1e-9);
        expect(layout.center.y + layout.radius).toBeLessThanOrEqual(height + 1e-9);
      }
      for (const m of marks.filter((mark) => mark.key.startsWith('slice:'))) {
        seen.count('slice');
        const i = Number(m.key.slice('slice:'.length));
        expect(layout.angles[i]!.end).toBeGreaterThan(layout.angles[i]!.start);
      }
    }), runs(RUNS));
    seen.atLeast('slice', RUNS / 4);
    seen.atLeast('drawn', RUNS / 4);
  }, timeoutFor(RUNS, 2));

  it('reads back a value as the legend writes it', () => {
    const value = fc.oneof(fc.integer({ min: 0, max: 1e6 }), fc.double({ min: 0, noNaN: true, noDefaultInfinity: true }), fc.constantFrom(0, 5e-324, Number.MAX_VALUE, 1e21));
    fc.assert(fc.property(value, (v) => {
      expect(pieValueOf(pieValueText(v))).toBe(v);
      expect(pieValueOf(String(v))).toBe(v);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});
