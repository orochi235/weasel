/**
 * Edits to a radar's axes and curves as collections, their ids, and the chart's options, as plain data in and out.
 * Every curve holds a value on each axis, so an axis that comes, goes, or moves takes a value of each curve with it.
 */
import { freshName, insertAt, moveAt, removeAt, updateAt, withOptional } from '../editing/lists';
import type { RadarAxis, RadarCurve, RadarData } from './types';

/** A curve's values stretched with zeros to the chart's axes. */
const valuesOf = (data: RadarData, c: RadarCurve): number[] => data.axes.map((_, i) => c.values[i] ?? 0);

const ID = /^\w+$/;

/** `data` with `axis` inserted before axis `at`, every curve 0 on it; absent, an axis under a fresh id. */
export function insertRadarAxis(data: RadarData, at: number, axis?: RadarAxis): RadarData {
  const next = axis ?? { id: freshName('axis', data.axes.map((a) => a.id), data.axes.length + 1, '') };
  const axes = insertAt(data.axes, at, next, 'insertRadarAxis');
  return { ...data, axes, curves: data.curves.map((c) => ({ ...c, values: insertAt(valuesOf(data, c), at, 0, 'insertRadarAxis') })) };
}

/** `data` without axis `axis` and each curve's value on it. Throws on an axis it does not hold. */
export function removeRadarAxis(data: RadarData, axis: number): RadarData {
  const axes = removeAt(data.axes, axis, 'removeRadarAxis');
  return { ...data, axes, curves: data.curves.map((c) => ({ ...c, values: removeAt(valuesOf(data, c), axis, 'removeRadarAxis') })) };
}

/** `data` with axis `from` moved to index `to`, counted once it is taken out, each curve's value on it moving too. */
export function moveRadarAxis(data: RadarData, from: number, to: number): RadarData {
  if (from === to) return data;
  const axes = moveAt(data.axes, from, to, 'moveRadarAxis');
  return { ...data, axes, curves: data.curves.map((c) => ({ ...c, values: moveAt(valuesOf(data, c), from, to, 'moveRadarAxis') })) };
}

/** `data` with `curve` inserted before curve `at`; absent, a curve of zeros under a fresh id. */
export function insertRadarCurve(data: RadarData, at: number, curve?: RadarCurve): RadarData {
  const next = curve ?? { id: freshName('curve', data.curves.map((c) => c.id), data.curves.length + 1, ''), values: data.axes.map(() => 0) };
  return { ...data, curves: insertAt(data.curves, at, next, 'insertRadarCurve') };
}

/** `data` without curve `curve`. Throws on a curve it does not hold. */
export const removeRadarCurve = (data: RadarData, curve: number): RadarData =>
  ({ ...data, curves: removeAt(data.curves, curve, 'removeRadarCurve') });

/** `data` with curve `from` moved to index `to`, counted once it is taken out. */
export const moveRadarCurve = (data: RadarData, from: number, to: number): RadarData =>
  (from === to ? data : { ...data, curves: moveAt(data.curves, from, to, 'moveRadarCurve') });

/** `items` with item `index`'s id `id`. Throws on an id that is not a word or that another item holds. */
function reid<T extends { id: string }>(items: readonly T[], index: number, id: string, who: string): readonly T[] {
  const target = items[index];
  if (target === undefined) throw new Error(`${who}: no item ${index}`);
  if (target.id === id) return items;
  if (!ID.test(id)) throw new Error(`${who}: an id is letters, digits and underscores, and "${id}" is not`);
  if (items.some((x) => x.id === id)) throw new Error(`${who}: an item already has id "${id}"`);
  return updateAt(items, index, (x) => ({ ...x, id }), who);
}

/** `data` with axis `axis`'s id set to `id`. Throws on an id that is not a word or another axis holds. */
export function setRadarAxisId(data: RadarData, axis: number, id: string): RadarData {
  const axes = reid(data.axes, axis, id, 'setRadarAxisId');
  return axes === data.axes ? data : { ...data, axes };
}

/** `data` with curve `curve`'s id set to `id`. Throws on an id that is not a word or another curve holds. */
export function setRadarCurveId(data: RadarData, curve: number, id: string): RadarData {
  const curves = reid(data.curves, curve, id, 'setRadarCurveId');
  return curves === data.curves ? data : { ...data, curves };
}

/** `data` with option `key` set to `value`; `undefined` drops it, for its default. */
export function setRadarOption<K extends 'min' | 'max' | 'ticks' | 'graticule' | 'showLegend'>(
  data: RadarData, key: K, value: RadarData[K] | undefined,
): RadarData {
  if (key === 'ticks' && value !== undefined && (!Number.isInteger(value) || (value as number) < 1)) {
    throw new Error(`setRadarOption: ticks is a whole number at least 1, and ${String(value)} is not`);
  }
  return data[key] === value ? data : withOptional(data, key, value);
}
