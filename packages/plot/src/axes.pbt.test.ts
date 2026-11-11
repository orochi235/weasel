/**
 * Axes on any scale: finite marks under distinct keys, a tick and a label per tick, each tick on the axis line
 * inside the range, and as much room reported as the labels and title take.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { axisMarks, axisRoom, type AxisSide } from './axes';
import { anyFinite, duplicateKeys, measure, nonFinite, runs, tally, timeoutFor } from './pbt.fixture';
import { bandScale } from './scales/band';
import { linearScale } from './scales/linear';
import { logScale } from './scales/log';
import { timeScale } from './scales/time';
import type { Scale } from './scales/types';
import { PLOT_THEME } from './theme';

const RUNS = 300;

const end = fc.oneof(fc.integer({ min: -1000, max: 1000 }), anyFinite);
const range = fc.tuple(fc.integer({ min: 0, max: 1500 }), fc.integer({ min: 0, max: 1500 }));
const scale: fc.Arbitrary<Scale<unknown>> = fc.oneof(
  fc.tuple(end, end, range).map(([d0, d1, r]) => linearScale({ domain: [d0, d1], range: r }) as Scale<unknown>),
  fc.tuple(fc.double({ min: 1e-300, max: 1e300, noNaN: true }), fc.double({ min: 1e-300, max: 1e300, noNaN: true }), range)
    .map(([d0, d1, r]) => logScale({ domain: [d0, d1], range: r }) as Scale<unknown>),
  fc.tuple(fc.integer({ min: -8.64e15, max: 8.64e15 }), fc.integer({ min: -8.64e15, max: 8.64e15 }), range)
    .map(([d0, d1, r]) => timeScale({ domain: [d0, d1], range: r }) as Scale<unknown>),
  fc.tuple(fc.uniqueArray(fc.string({ maxLength: 4 }), { maxLength: 8 }), range)
    .map(([keys, r]) => bandScale({ domain: keys, range: r }) as Scale<unknown>),
);
const side = fc.constantFrom<AxisSide>('top', 'bottom', 'left', 'right');

describe('axisMarks', () => {
  it('draws finite marks under distinct keys, a tick and a label per tick along the range', () => {
    const seen = tally();
    fc.assert(fc.property(scale, side, fc.integer({ min: -500, max: 500 }), fc.option(fc.constantFrom('Title', ''), { nil: undefined }), fc.option(fc.integer({ min: 0, max: 20 }), { nil: undefined }), fc.boolean(), (s, where, at, title, ticks, grid) => {
      const opts = { scale: s, side: where, at, theme: PLOT_THEME, measure, ...(title !== undefined ? { title } : {}), ...(ticks !== undefined ? { ticks } : {}), ...(grid ? { gridTo: at + 100 } : {}) };
      const marks = axisMarks(opts);
      expect(marks.flatMap((m) => nonFinite(m, m.key))).toEqual([]);
      expect(duplicateKeys(marks)).toEqual([]);
      const values = s.ticks(ticks);
      const tickMarks = marks.filter((m) => m.key.includes(':tick:'));
      expect(tickMarks).toHaveLength(values.length);
      expect(marks.filter((m) => m.key.includes(':label:'))).toHaveLength(values.length);
      const [lo, hi] = [Math.min(...s.range), Math.max(...s.range)];
      const horizontal = where === 'top' || where === 'bottom';
      for (const m of tickMarks) {
        const along = horizontal ? m.pose.x : m.pose.y;
        expect(along).toBeGreaterThanOrEqual(lo - 1e-3);
        expect(along).toBeLessThanOrEqual(hi + 1e-3);
      }
      if (values.length > 0) seen.count('ticked');
      const room = axisRoom(opts);
      expect(Number.isFinite(room) && room > 0).toBe(true);
      const reach = marks.filter((m) => !m.key.includes(':grid:')).reduce((most, m) => {
        // The box a rotated mark covers, about its center.
        const { x, y, width, height, rotation = 0 } = m.pose;
        const [c, sn] = [Math.abs(Math.cos(rotation)), Math.abs(Math.sin(rotation))];
        const [hw, hh] = [(width * c + height * sn) / 2, (width * sn + height * c) / 2];
        const [cx, cy] = [x + width / 2, y + height / 2];
        const far = horizontal
          ? (where === 'bottom' ? cy + hh - at : at - (cy - hh))
          : (where === 'right' ? cx + hw - at : at - (cx - hw));
        return Math.max(most, far);
      }, 0);
      expect(reach).toBeLessThanOrEqual(room + 1e-6);
    }), runs(RUNS));
    seen.atLeast('ticked', RUNS / 2);
  }, timeoutFor(RUNS, 3));
});
