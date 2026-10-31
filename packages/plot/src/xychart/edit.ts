/** Edits to an xychart, as plain data in and out. */
import { decimalsOf } from '../scales/linear';
import type { XyLayout } from './compile';
import type { XyChartData } from './types';

/** `data` with series `series`'s value at `index` set to `value`. Throws on an index the series does not hold. */
export function setXyValue(data: XyChartData, series: number, index: number, value: number): XyChartData {
  const target = data.series[series];
  if (target === undefined || index < 0 || index >= target.values.length) {
    throw new Error(`setXyValue: series ${series} holds no value ${index}`);
  }
  if (target.values[index] === value) return data;
  const values = target.values.map((v, i) => (i === index ? value : v));
  return { ...data, series: data.series.map((s, i) => (i === series ? { ...s, values } : s)) };
}

/** The value a point stands at along `layout`'s value axis, rounded to a tenth of its tick step. */
export function xyValueAt(layout: XyLayout, at: { x: number; y: number }): number {
  const raw = layout.value.invert(layout.orientation === 'vertical' ? at.y : at.x);
  const step = layout.value.tickStep() / 10;
  return Number((Math.round(raw / step) * step).toFixed(decimalsOf(step)));
}
