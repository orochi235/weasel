import { describe, expect, it } from 'vitest';
import { compilePlot } from '../plotData';
import { PLOT_THEME } from '../theme';
import { setXyValue, xyRows } from './edit';
import {
  insertXyRow, insertXySeries, moveXyRow, moveXySeries, removeXyRow, removeXySeries, setXyAxisTitle, setXyCategory, setXyOrientation,
  setXyRangeBound, setXySeriesKind, setXySeriesName, setXyValueBound, setXyXKind,
} from './structure';
import type { XyChartData } from './types';

const measure = (text: string) => ({ width: text.length * 7, height: 14 });
const compiles = (d: XyChartData) => expect(compilePlot(d, { width: 600, height: 400 }, PLOT_THEME, measure).length).toBeGreaterThan(0);
const EMPTY: XyChartData = { kind: 'xychart', series: [] };

describe('xychart structure', () => {
  it('builds a chart from nothing: series, then rows that hold a value of each', () => {
    let d = insertXySeries(EMPTY, 0);
    d = insertXyRow(d, 0);
    d = insertXyRow(d, 1);
    d = insertXySeries(d, 1);
    expect(d.series).toEqual([{ kind: 'bar', name: 'Series 1', values: [0, 0] }, { kind: 'bar', name: 'Series 2', values: [0, 0] }]);
    d = setXyCategory(d, 0, 'Jan');
    expect(d.x).toEqual({ kind: 'band', categories: ['Jan', '2'] });
    d = setXyValue(setXyValue(d, 0, 1, 7), 1, 0, 3);
    d = setXySeriesKind(setXySeriesName(d, 1, ' Trend '), 1, 'line');
    expect(d.series[1]).toEqual({ kind: 'line', name: 'Trend', values: [3, 0] });
    compiles(d);
  });

  it('keeps every series and the labels in step as rows come, go and move', () => {
    const d: XyChartData = { kind: 'xychart', x: { kind: 'band', categories: ['a', 'b', 'c'] }, series: [{ kind: 'bar', values: [1, 2] }] };
    expect(xyRows(d)).toBe(3);
    const grown = insertXyRow(d, 1, 'z');
    expect(grown.x).toEqual({ kind: 'band', categories: ['a', 'z', 'b', 'c'] });
    expect(grown.series[0]!.values).toEqual([1, 0, 2, 0]);
    expect(moveXyRow(d, 0, 2).series[0]!.values).toEqual([2, 0, 1]);
    expect(removeXyRow(d, 0)).toEqual({ ...d, x: { kind: 'band', categories: ['b', 'c'] }, series: [{ kind: 'bar', values: [2, 0] }] });
    expect(() => removeXyRow(d, 3)).toThrow(/no row 3/);
    expect(setXyValue(d, 0, 2, 9).series[0]!.values).toEqual([1, 2, 9]);
    expect(() => setXyValue(d, 0, 3, 9)).toThrow(/holds no value 3/);
  });

  it('moves and removes series', () => {
    const d: XyChartData = { kind: 'xychart', series: [{ kind: 'bar', name: 'a', values: [1] }, { kind: 'line', name: 'b', values: [2] }] };
    expect(moveXySeries(d, 0, 1).series.map((s) => s.name)).toEqual(['b', 'a']);
    expect(removeXySeries(d, 0).series.map((s) => s.name)).toEqual(['b']);
    expect(setXySeriesName(d, 0, '').series[0]).toEqual({ kind: 'bar', values: [1] });
  });

  it('sets the axes: orientation, titles, a range and the value axis\'s ends', () => {
    const d: XyChartData = { kind: 'xychart', series: [{ kind: 'bar', values: [1, 2, 3] }] };
    expect(setXyOrientation(setXyOrientation(d, 'horizontal'), 'vertical')).toEqual(d);
    const range = setXyRangeBound(setXyXKind(setXyAxisTitle(d, 'x', 'Day'), 'range'), 'max', 10);
    expect(range.x).toEqual({ kind: 'range', min: 0, max: 10, title: 'Day' });
    expect(setXyXKind(range, 'band').x).toEqual({ kind: 'band', categories: ['1', '2', '3'], title: 'Day' });
    expect(() => setXyRangeBound(d, 'min', 1)).toThrow(/categories/);
    expect(() => setXyCategory(range, 0, 'x')).toThrow(/range/);
    const y = setXyValueBound(setXyValueBound(setXyAxisTitle(d, 'y', 'Sales'), 'min', 0), 'max', 50);
    expect(y.y).toEqual({ title: 'Sales', min: 0, max: 50 });
    expect(setXyAxisTitle(setXyValueBound(setXyValueBound(y, 'min', undefined), 'max', undefined), 'y', '')).toEqual(d);
    compiles(range);
    compiles(y);
  });
});
