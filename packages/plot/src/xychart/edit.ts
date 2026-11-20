/** Edits to an xychart, as plain data in and out. */
import { decimalsOf, type LinearScale } from '@weasel-js/scale';
import { xyLength } from './compile';
import type { XyChartData, XyValueAxis } from './types';

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

/** The value standing at `along` on the value axis `value` (an `XyScales` or `XyLayout`'s), rounded to a
 *  tenth of its tick step, and held inside whichever ends `held` sets. */
export function xyValueAt(value: LinearScale, along: number, held: XyValueAxis = {}): number {
  const raw = value.invert(along);
  const step = value.tickStep() / 10;
  const v = Number((Math.round(raw / step) * step).toFixed(decimalsOf(step)));
  const [d0, d1] = value.domain;
  const [lowEnd, highEnd] = d0 <= d1 ? [held.min, held.max] : [held.max, held.min];
  const lo = lowEnd === undefined ? Number.NEGATIVE_INFINITY : Math.min(d0, d1);
  const hi = highEnd === undefined ? Number.POSITIVE_INFINITY : Math.max(d0, d1);
  return Math.min(hi, Math.max(lo, v));
}
