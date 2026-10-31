import { describe, expect, it } from 'vitest';
import { PLOT_THEME, seriesColor } from '../theme';
import { compileXyChart, xyValueDomain } from './compile';
import { setXyValue, xyValueAt } from './edit';
import { handlesOf } from '../editing/editors';
import { xyEditor } from './editor';
import type { XyChartData } from './types';

const measure = (text: string) => ({ width: text.length * 7, height: 14 });
const SIZE = { width: 600, height: 400 };

const SALES: XyChartData = {
  kind: 'xychart',
  title: 'Sales',
  x: { kind: 'band', categories: ['jan', 'feb', 'mar'] },
  y: { title: 'Revenue', min: 0, max: 100 },
  series: [
    { kind: 'bar', values: [20, 50, 80] },
    { kind: 'line', values: [10, 60, 40] },
  ],
};

const byKey = (data: XyChartData) => {
  const { marks, layout } = compileXyChart(data, SIZE, PLOT_THEME, measure);
  return { layout, marks, get: (key: string) => marks.find((m) => m.key === key) };
};

describe('compileXyChart', () => {
  it('draws a bar per value from the baseline, keeping series, index and value', () => {
    const { layout, get } = byKey(SALES);
    const bar = get('bar:0:1')!;
    expect(bar.data.plotMark).toEqual({ kind: 'bar', datum: { series: 0, index: 1, value: 50, category: 'feb' } });
    expect(bar.pose.y + bar.pose.height).toBeCloseTo(layout.value.map(0));
    expect(bar.pose.y).toBeCloseTo(layout.value.map(50));
    expect(bar.pose.x + bar.pose.width / 2).toBeCloseTo(layout.slots[1]!);
    expect(bar.data.fill?.paint.color).toBe(seriesColor(PLOT_THEME, 0));
  });

  it('draws a line through the line series and a point on each value', () => {
    const { layout, get } = byKey(SALES);
    expect(get('line:1')!.data.stroke?.paint.color).toBe(seriesColor(PLOT_THEME, 1));
    const point = get('point:1:2')!;
    expect(point.pose.y + point.pose.height / 2).toBeCloseTo(layout.value.map(40));
    expect(point.data.plotMark.datum).toMatchObject({ series: 1, index: 2, value: 40 });
  });

  it('lays the plot area out inside the title and the axes', () => {
    const { layout, get } = byKey(SALES);
    const title = get('title')!;
    expect(title.data.text).toBe('Sales');
    expect(layout.plot.y).toBeGreaterThan(title.pose.y + title.pose.height);
    expect(layout.value.domain).toEqual([0, 100]);
    expect(get('axis:value:label:5')!.data.text).toBe('100');
    expect(get('axis:category:label:2')!.data.text).toBe('mar');
    expect(get('axis:value:title')!.data.text).toBe('Revenue');
    expect(layout.plot.x + layout.plot.width).toBe(SIZE.width - 12);
  });

  it('fits a missing value range to the values, zero included', () => {
    expect(xyValueDomain({ kind: 'xychart', series: [{ kind: 'bar', values: [3, 97] }] })).toEqual([0, 100]);
    expect(xyValueDomain({ kind: 'xychart', series: [{ kind: 'bar', values: [-12, 40] }] })).toEqual([-20, 40]);
    expect(xyValueDomain({ kind: 'xychart', y: { max: 10 }, series: [] })).toEqual([0, 10]);
  });

  it('numbers its bands when it has no categories, and spreads values over a range axis', () => {
    const numbered = byKey({ kind: 'xychart', series: [{ kind: 'bar', values: [1, 2] }] });
    expect(numbered.get('axis:category:label:1')!.data.text).toBe('2');
    const ranged = byKey({ kind: 'xychart', x: { kind: 'range', min: 0, max: 10 }, series: [{ kind: 'line', values: [1, 2, 3, 4] }] });
    const [a, b, c] = ranged.layout.slots;
    expect(b! - a!).toBeCloseTo(c! - b!);
    expect(ranged.get('axis:category:label:0')!.data.text).toBe('0');
  });

  it('runs categories down y and values along x when horizontal', () => {
    const { layout, get } = byKey({ ...SALES, orientation: 'horizontal' });
    const bar = get('bar:0:2')!;
    expect(bar.pose.x).toBeCloseTo(layout.value.map(0));
    expect(bar.pose.x + bar.pose.width).toBeCloseTo(layout.value.map(80));
    expect(layout.slots[0]!).toBeLessThan(layout.slots[2]!);
  });

  it('shares each band among its bar series', () => {
    const { get } = byKey({ ...SALES, series: [{ kind: 'bar', values: [1] }, { kind: 'bar', values: [2] }] });
    const [a, b] = [get('bar:0:0')!, get('bar:1:0')!];
    expect(b.pose.x).toBeCloseTo(a.pose.x + a.pose.width);
  });
});

describe('xychart edits', () => {
  it('setXyValue replaces one value and nothing else', () => {
    const next = setXyValue(SALES, 1, 2, 55);
    expect(next.series[1]!.values).toEqual([10, 60, 55]);
    expect(next.series[0]).toBe(SALES.series[0]);
    expect(SALES.series[1]!.values).toEqual([10, 60, 40]);
    expect(setXyValue(SALES, 0, 0, 20)).toBe(SALES);
    expect(() => setXyValue(SALES, 0, 9, 1)).toThrow(/holds no value 9/);
  });

  it('xyValueAt reads the value axis, rounded to a tenth of a tick', () => {
    const { layout } = byKey(SALES);
    expect(xyValueAt(layout, { x: 0, y: layout.value.map(42.3) })).toBe(42);
    expect(xyValueAt(layout, { x: 0, y: layout.value.map(57.8) })).toBe(58);
  });

  it('the editor puts a handle on a bar\'s end and on each point, and a drag proposes the value under the pointer', () => {
    const { layout, get } = byKey(SALES);
    const bar = get('bar:0:1')!;
    const handle = handlesOf(xyEditor.handle(SALES, { trait: bar.data.plotMark, pose: bar.pose }))[0]!;
    expect(handle.at.y).toBeCloseTo(bar.pose.y);
    expect(handle.cursor).toBe('ns-resize');
    expect(xyEditor.handle(SALES, { trait: get('line:1')!.data.plotMark, pose: get('line:1')!.pose })).toBeNull();
    const drag = xyEditor.drag(SALES, bar.data.plotMark, SIZE, PLOT_THEME, measure)!;
    expect(drag({ x: handle.at.x, y: layout.value.map(70) }).series[0]!.values).toEqual([20, 70, 80]);
  });
});
