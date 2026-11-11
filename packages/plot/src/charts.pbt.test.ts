/**
 * Every chart kind, compiled from any data in any box: it does not throw, every number it draws is finite, and no
 * two marks share a key.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { compilePlot } from './plotData';
import { compileRadar } from './radar/compile';
import { compileXyChart } from './xychart/compile';
import { duplicateKeys, measure, nonFinite, plotData, radarData, runs, size, tally, timeoutFor, xyData } from './pbt.fixture';
import { PLOT_THEME } from './theme';

const RUNS = 400;

describe('compilePlot, any chart', () => {
  it('draws only finite geometry, under keys unique within the plot', () => {
    const seen = tally();
    fc.assert(fc.property(plotData, size, (data, box) => {
      const marks = compilePlot(data, box, PLOT_THEME, measure);
      seen.count(data.kind);
      if (marks.length > 0) seen.count('marks');
      expect(marks.flatMap((m) => nonFinite(m, m.key))).toEqual([]);
      expect(duplicateKeys(marks)).toEqual([]);
    }), runs(RUNS));
    for (const kind of ['pie', 'sankey', 'xychart', 'radar', 'quadrant', 'journey', 'timeline', 'packet', 'gitgraph', 'gantt']) {
      seen.atLeast(kind, RUNS / 40);
    }
    seen.atLeast('marks', RUNS / 2);
  }, timeoutFor(RUNS, 5));

  it('cuts an xychart\'s and a radar\'s data to the plot area, whatever the values and fixed ends', () => {
    const seen = tally();
    const box = fc.record({ width: fc.integer({ min: 100, max: 2000 }), height: fc.integer({ min: 100, max: 2000 }) });
    fc.assert(fc.property(fc.oneof(xyData, radarData), box, (data, b) => {
      // Within a sliver of the area, for the float32 a path stores.
      const eps = 1e-3;
      if (data.kind === 'xychart') {
        const { marks, layout } = compileXyChart(data, b, PLOT_THEME, measure);
        const [lo, hi] = [Math.min(...layout.value.range), Math.max(...layout.value.range)];
        const v = layout.orientation === 'vertical';
        const area = v ? { x0: layout.plot.x, x1: layout.plot.x + layout.plot.width, y0: lo, y1: hi } : { x0: lo, x1: hi, y0: layout.plot.y, y1: layout.plot.y + layout.plot.height };
        for (const m of marks.filter((mk) => /^(bar|line):/.test(mk.key) || (/^point:/.test(mk.key)))) {
          seen.count('xy');
          const { x, y, width, height } = m.pose;
          const r = m.key.startsWith('point:') ? width / 2 : 0;
          expect(x + r).toBeGreaterThanOrEqual(area.x0 - eps);
          expect(x + width - r).toBeLessThanOrEqual(area.x1 + eps);
          expect(y + r).toBeGreaterThanOrEqual(area.y0 - eps);
          expect(y + height - r).toBeLessThanOrEqual(area.y1 + eps);
        }
      } else {
        const { marks, layout } = compileRadar(data, b, PLOT_THEME, measure);
        const { center, radius } = layout.scale;
        const rim = radius[1] / Math.cos(Math.PI / 72) + eps;
        for (const m of marks.filter((mk) => /^(curve|point):/.test(mk.key))) {
          seen.count('radar');
          const r = m.key.startsWith('point:') ? m.pose.width / 2 : 0;
          const corners = r > 0
            ? [[m.pose.x + r, m.pose.y + r]]
            : [[m.pose.x, m.pose.y], [m.pose.x + m.pose.width, m.pose.y + m.pose.height]];
          for (const [x, y] of corners) {
            expect(Math.abs(x! - center.x)).toBeLessThanOrEqual(rim);
            expect(Math.abs(y! - center.y)).toBeLessThanOrEqual(rim);
          }
        }
      }
    }), runs(RUNS));
    seen.atLeast('xy', RUNS / 4);
    seen.atLeast('radar', RUNS / 4);
  }, timeoutFor(RUNS, 5));
});
