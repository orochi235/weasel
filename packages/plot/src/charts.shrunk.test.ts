/** Counterexamples the chart property tests shrank to, kept as plain examples: each compiles to finite geometry. */
import { describe, expect, it } from 'vitest';
import { compileQuadrant } from './quadrant/compile';
import { compilePlot, type PlotData } from './plotData';
import { measure, nonFinite } from './pbt.fixture';
import { sankeyLayout } from './sankey/layout';
import { PLOT_THEME } from './theme';

const MAX = Number.MAX_VALUE;
const finite = (data: PlotData, size = { width: 0, height: 0 }): void => {
  const marks = compilePlot(data, size, PLOT_THEME, measure);
  expect(marks.flatMap((m) => nonFinite(m, m.key))).toEqual([]);
};

describe('charts, shrunk', () => {
  it('draws no quadrant point without a place, holds one to the unit square, and its radius to the plot', () => {
    finite({ kind: 'quadrant', points: [{ name: 'a', x: 0, y: Number.NaN }] });
    finite({ kind: 'quadrant', points: [{ name: 'a', x: 6.54389147653334e36, y: 0 }] }, { width: 96, height: 0 });
    finite({ kind: 'quadrant', points: [{ name: 'a', x: 0, y: 0, style: { radius: 3.4028235677973366e38 } }] });
    const { marks, layout } = compileQuadrant({ kind: 'quadrant', points: [{ name: 'a', x: 2, y: -1, style: { radius: -4 } }] }, { width: 400, height: 300 }, PLOT_THEME, measure);
    const point = marks.find((m) => m.key === 'point:0')!;
    expect(point.pose.x + point.pose.width / 2).toBe(layout.plot.x + layout.plot.width);
    expect(point.pose.y + point.pose.height / 2).toBe(layout.plot.y + layout.plot.height);
    expect(point.pose.width).toBe(10);
  });

  it('reads a fractional bit as the bit it falls in', () => {
    finite({ kind: 'packet', fields: [{ start: 0, end: 5e-324, label: 'a' }] });
  });

  it('draws no face for a journey step without a score', () => {
    const data: PlotData = { kind: 'journey', sections: [{ tasks: [{ name: 'a', score: Number.NaN, actors: [] }] }] };
    finite(data);
    const keys = compilePlot(data, { width: 600, height: 400 }, PLOT_THEME, measure).map((m) => m.key);
    expect(keys).toContain('task:label:0:0');
    expect(keys).not.toContain('task:0:0');
  });

  it('draws a radar value short of the center\'s at the center', () => {
    finite({ kind: 'radar', axes: [{ id: '' }, { id: 'a' }], curves: [{ id: 'a', values: [-1e308] }] });
  });

  it('lays out sankey flows whose sum is past the double range, and every node inside a narrow box', () => {
    finite({ kind: 'sankey', links: [{ source: 'a', target: 'a', value: 9.9792015476736e291 }, { source: 'a', target: 'a', value: MAX }] });
    const layout = sankeyLayout({ kind: 'sankey', links: [{ source: 'a', target: 'b', value: 0 }] }, { x: 0, y: 0, width: 1, height: 1 });
    expect(layout.nodes.map((n) => n.x)).toEqual([0, 0]);
  });

  it('places an xychart\'s values when the axis spans past the double range', () => {
    finite({ kind: 'xychart', series: [{ kind: 'bar', values: [MAX, -5.000000000000001e298] }] });
    finite({ kind: 'xychart', series: [{ kind: 'bar', values: [9.9792015476736e291, -MAX] }] });
  });

  it('draws a gantt task whose end is past what a Date or a number holds', () => {
    finite({ kind: 'gantt', sections: [{ tasks: [{ name: 'a', start: { kind: 'after', ids: [] }, end: { kind: 'duration', amount: -3286171, unit: 'M' } }] }] });
    finite({ kind: 'gantt', sections: [{ tasks: [{ name: 'a', start: { kind: 'date', date: '1970-01-01' }, end: { kind: 'duration', amount: MAX, unit: 'm' } }] }] });
    finite({ kind: 'gantt', dateFormat: 'x', sections: [{ tasks: [{ name: 'a', start: { kind: 'date', date: `-${'9'.repeat(400)}` }, end: { kind: 'date', date: '0' } }] }] });
  });
});
