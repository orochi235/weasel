/** Edits to an xychart, as plain data in and out. */
import { decimalsOf } from '../scales/linear';
import { xyLength, type XyLayout } from './compile';
import type { XyChartData } from './types';

/** How many rows the chart has: its categories, or its longest series where that is longer. */
export const xyRows = (data: XyChartData): number => Math.max(data.x?.kind === 'band' ? data.x.categories.length : 0, xyLength(data));

/** `data` with series `series`'s value at `index` set to `value`, a shorter series padded with zeros. Throws on a series
 *  the chart does not hold or an index past its last row. */
export function setXyValue(data: XyChartData, series: number, index: number, value: number): XyChartData {
  const target = data.series[series];
  if (target === undefined || !Number.isInteger(index) || index < 0 || index >= xyRows(data)) {
    throw new Error(`setXyValue: series ${series} holds no value ${index}`);
  }
  if (target.values[index] === value) return data;
  const values = Array.from({ length: Math.max(target.values.length, index + 1) }, (_, i) => (i === index ? value : target.values[i] ?? 0));
  return { ...data, series: data.series.map((s, i) => (i === series ? { ...s, values } : s)) };
}

/** The value a point stands at along `layout`'s value axis, rounded to a tenth of its tick step. */
export function xyValueAt(layout: XyLayout, at: { x: number; y: number }): number {
  const raw = layout.value.invert(layout.orientation === 'vertical' ? at.y : at.x);
  const step = layout.value.tickStep() / 10;
  return Number((Math.round(raw / step) * step).toFixed(decimalsOf(step)));
}
