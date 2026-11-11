/**
 * Every chart kind, compiled from any data in any box: it does not throw, every number it draws is finite, and no
 * two marks share a key.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { compilePlot } from './plotData';
import { duplicateKeys, measure, nonFinite, plotData, runs, size, tally, timeoutFor } from './pbt.fixture';
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
});
