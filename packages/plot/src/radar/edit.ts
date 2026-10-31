/** Edits to a radar, as plain data in and out. */
import { decimalsOf } from '../scales/linear';
import type { PlotPoint } from '../marks/types';
import type { RadarLayout } from './compile';
import type { RadarData } from './types';

/** `data` with curve `curve`'s value on axis `axis` set to `value`. Throws on a curve or axis it does not hold. */
export function setRadarValue(data: RadarData, curve: number, axis: number, value: number): RadarData {
  const target = data.curves[curve];
  if (target === undefined || axis < 0 || axis >= data.axes.length) throw new Error(`setRadarValue: curve ${curve} holds no value on axis ${axis}`);
  if (target.values[axis] === value) return data;
  const values = data.axes.map((_, i) => (i === axis ? value : target.values[i] ?? 0));
  return { ...data, curves: data.curves.map((c, i) => (i === curve ? { ...c, values } : c)) };
}

/** `items` with item `index`'s label set to `text`, trimmed; an empty one, or its id, drops it. `null` when that changes nothing. */
function relabel<T extends { id: string; label?: string }>(items: readonly T[], index: number, text: string, what: string): T[] | null {
  const item = items[index];
  if (item === undefined) throw new Error(`${what}: no item ${index}`);
  const label = text.trim();
  const next = label === '' || label === item.id ? undefined : label;
  if (next === item.label) return null;
  const { label: _, ...rest } = item;
  return items.map((x, i) => (i === index ? (next === undefined ? rest : { ...rest, label: next }) as T : x));
}

/** `data` with axis `axis`'s label set to `text`; an empty label falls back to the axis's id. Throws on an axis it does not hold. */
export function setRadarAxisLabel(data: RadarData, axis: number, text: string): RadarData {
  const axes = relabel(data.axes, axis, text, 'setRadarAxisLabel');
  return axes === null ? data : { ...data, axes };
}

/** `data` with curve `curve`'s label set to `text`; an empty label falls back to the curve's id. Throws on a curve it does not hold. */
export function setRadarCurveLabel(data: RadarData, curve: number, text: string): RadarData {
  const curves = relabel(data.curves, curve, text, 'setRadarCurveLabel');
  return curves === null ? data : { ...data, curves };
}

/** The value on axis `axis` nearest `at`, rounded to a tenth of the scale's tick step. */
export function radarValueAt(layout: RadarLayout, axis: number, at: PlotPoint): number {
  const raw = layout.scale.valueAt(axis, at);
  const step = layout.scale.tickStep() / 10;
  return Number((Math.round(raw / step) * step).toFixed(decimalsOf(step)));
}
