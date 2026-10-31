/** Edits to a pie's slices as a collection, and its options, as plain data in and out. */
import { freshName, insertAt, moveAt, removeAt, withOptional } from '../editing/lists';
import type { PieData, PieSlice } from './types';

/** `data` with `slice` inserted before slice `at`; absent, a slice of 1 under a label no slice holds. */
export function insertPieSlice(data: PieData, at: number, slice?: PieSlice): PieData {
  const next = slice ?? { label: freshName('Slice', data.slices.map((s) => s.label), data.slices.length + 1), value: 1 };
  return { ...data, slices: insertAt(data.slices, at, next, 'insertPieSlice') };
}

/** `data` without slice `slice`. Throws on a slice it does not hold. */
export const removePieSlice = (data: PieData, slice: number): PieData =>
  ({ ...data, slices: removeAt(data.slices, slice, 'removePieSlice') });

/** `data` with slice `from` moved to index `to`, counted once it is taken out. */
export const movePieSlice = (data: PieData, from: number, to: number): PieData =>
  (from === to ? data : { ...data, slices: moveAt(data.slices, from, to, 'movePieSlice') });

/** `data` writing, or not, each slice's value in the legend. */
export const setPieShowData = (data: PieData, show: boolean): PieData =>
  ((data.showData ?? false) === show ? data : withOptional(data, 'showData', show ? true : undefined));
