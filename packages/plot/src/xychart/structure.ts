/**
 * Edits to an xychart's rows, series, and axes, as plain data in and out. A row is one category (or one step along a
 * range axis) and holds a value of every series.
 */
import { freshName, insertAt, moveAt, removeAt, updateAt, withOptional } from '../editing/lists';
import { xyRows } from './edit';
import type { XyBandAxis, XyChartData, XyRangeAxis, XySeries, XyValueAxis } from './types';

/** `values` stretched with zeros to `n`. */
const padded = (values: readonly number[], n: number): number[] => Array.from({ length: Math.max(n, values.length) }, (_, i) => values[i] ?? 0);

/** The band axis's labels stretched to `n`, a missing one numbered as the chart numbers it. */
const labels = (categories: readonly string[], n: number): string[] => Array.from({ length: n }, (_, i) => categories[i] ?? String(i + 1));

/** Whether the chart's rows carry labels of their own. */
const labeled = (data: XyChartData): boolean => data.x?.kind === 'band' && data.x.categories.length > 0;

/** `data` with every series' values run through `values` and the band labels through `names`, each stretched to the
 *  chart's rows first. */
function eachRow(data: XyChartData, values: (list: number[]) => number[], names: (list: string[]) => string[]): XyChartData {
  const n = xyRows(data);
  const series = data.series.map((s) => ({ ...s, values: values(padded(s.values, n)) }));
  if (!labeled(data) || data.x?.kind !== 'band') return { ...data, series };
  return { ...data, series, x: { ...data.x, categories: names(labels(data.x.categories, n)) } };
}

/** `data` with a row before row `at`: a zero in every series and, where rows are labeled, `label` (absent, a fresh one). */
export function insertXyRow(data: XyChartData, at: number, label?: string): XyChartData {
  const n = xyRows(data);
  if (!Number.isInteger(at) || at < 0 || at > n) throw new Error(`insertXyRow: cannot insert at ${at} in ${n} rows`);
  const name = label ?? freshName('Category', data.x?.kind === 'band' ? data.x.categories : [], n + 1);
  return eachRow(data, (list) => insertAt(list, at, 0, 'insertXyRow'), (list) => insertAt(list, at, name, 'insertXyRow'));
}

/** `data` without row `at`, in every series and the labels. Throws on a row it does not hold. */
export function removeXyRow(data: XyChartData, at: number): XyChartData {
  const n = xyRows(data);
  if (!Number.isInteger(at) || at < 0 || at >= n) throw new Error(`removeXyRow: no row ${at} in ${n}`);
  return eachRow(data, (list) => removeAt(list, at, 'removeXyRow'), (list) => removeAt(list, at, 'removeXyRow'));
}

/** `data` with row `from` moved to index `to`, counted once it is taken out, in every series and the labels. */
export const moveXyRow = (data: XyChartData, from: number, to: number): XyChartData =>
  (from === to ? data : eachRow(data, (list) => moveAt(list, from, to, 'moveXyRow'), (list) => moveAt(list, from, to, 'moveXyRow')));

/** `data` with row `index` labeled `label`, the axis turned to categories when it was numbered. */
export function setXyCategory(data: XyChartData, index: number, label: string): XyChartData {
  const n = xyRows(data);
  if (!Number.isInteger(index) || index < 0 || index >= n) throw new Error(`setXyCategory: no row ${index} in ${n}`);
  if (data.x?.kind === 'range') throw new Error('setXyCategory: the chart runs along a range, not categories');
  const categories = labels(data.x?.categories ?? [], n);
  if (labeled(data) && categories[index] === label) return data;
  categories[index] = label;
  return { ...data, x: { ...(data.x ?? { kind: 'band' }), categories } };
}

/** `data` with `series` inserted before series `at`; absent, a bar series of zeros under a fresh name. */
export function insertXySeries(data: XyChartData, at: number, series?: XySeries): XyChartData {
  const next = series ?? {
    kind: 'bar', name: freshName('Series', data.series.flatMap((s) => (s.name === undefined ? [] : [s.name])), data.series.length + 1),
    values: padded([], xyRows(data)),
  };
  return { ...data, series: insertAt(data.series, at, next, 'insertXySeries') };
}

/** `data` without series `series`. Throws on a series it does not hold. */
export const removeXySeries = (data: XyChartData, series: number): XyChartData =>
  ({ ...data, series: removeAt(data.series, series, 'removeXySeries') });

/** `data` with series `from` moved to index `to`, counted once it is taken out. */
export const moveXySeries = (data: XyChartData, from: number, to: number): XyChartData =>
  (from === to ? data : { ...data, series: moveAt(data.series, from, to, 'moveXySeries') });

/** `data` with series `series` changed by `change`; `data` itself when nothing changes. */
function withSeries(data: XyChartData, series: number, change: (s: XySeries) => XySeries, who: string): XyChartData {
  const next = updateAt(data.series, series, change, who);
  return next[series] === data.series[series] ? data : { ...data, series: next };
}

/** `data` with series `series` named `name`, trimmed; an empty name drops it. */
export const setXySeriesName = (data: XyChartData, series: number, name: string | undefined): XyChartData =>
  withSeries(data, series, (s) => {
    const text = name?.trim() || undefined;
    return s.name === text ? s : withOptional(s, 'name', text);
  }, 'setXySeriesName');

/** `data` with series `series` drawn as bars or as a line. */
export const setXySeriesKind = (data: XyChartData, series: number, kind: XySeries['kind']): XyChartData =>
  withSeries(data, series, (s) => (s.kind === kind ? s : { ...s, kind }), 'setXySeriesKind');

/** `data` with categories along x and values along y, or (`'horizontal'`) the other way round. */
export const setXyOrientation = (data: XyChartData, orientation: 'vertical' | 'horizontal'): XyChartData =>
  ((data.orientation ?? 'vertical') === orientation ? data : withOptional(data, 'orientation', orientation === 'horizontal' ? orientation : undefined));

/** `data` running along categories (each row labeled, numbered ones kept as written) or a numeric range from 0 to the
 *  row count. The axis keeps its title. */
export function setXyXKind(data: XyChartData, kind: 'band' | 'range'): XyChartData {
  if ((data.x?.kind ?? 'band') === kind) return data;
  const title = data.x?.title;
  const n = xyRows(data);
  const x = kind === 'range' ? { kind, min: 0, max: n } as const : { kind, categories: labels([], n) } as const;
  return { ...data, x: title === undefined ? x : { ...x, title } };
}

/** `data` with an axis titled `title`, trimmed; an empty one drops it. */
export function setXyAxisTitle(data: XyChartData, axis: 'x' | 'y', title: string | undefined): XyChartData {
  const text = title?.trim() || undefined;
  const current = data[axis];
  if (current?.title === text) return data;
  if (axis === 'x') {
    const x: XyBandAxis | XyRangeAxis = data.x ?? { kind: 'band', categories: [] };
    return { ...data, x: withOptional<XyBandAxis | XyRangeAxis, 'title'>(x, 'title', text) };
  }
  return withAxis(data, withOptional(data.y ?? {}, 'title', text));
}

/** `data` with its value axis `y`, or none when `y` holds nothing. */
const withAxis = (data: XyChartData, y: XyValueAxis): XyChartData => withOptional(data, 'y', Object.keys(y).length === 0 ? undefined : y);

/** `data` with the value axis's end `end` at `value`; `undefined` lets it fit the values. */
export function setXyValueBound(data: XyChartData, end: 'min' | 'max', value: number | undefined): XyChartData {
  if (data.y?.[end] === value) return data;
  return withAxis(data, withOptional(data.y ?? {}, end, value));
}

/** `data` with the range axis's end `end` at `value`. Throws on a chart not running along a range. */
export function setXyRangeBound(data: XyChartData, end: 'min' | 'max', value: number): XyChartData {
  if (data.x?.kind !== 'range') throw new Error('setXyRangeBound: the chart runs along categories, not a range');
  return data.x[end] === value ? data : { ...data, x: { ...data.x, [end]: value } };
}
