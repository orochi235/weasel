/** Edits to a pie, as plain data in and out. */
import type { PieData, PieSlice } from './types';

function withSlice(data: PieData, slice: number, change: Partial<PieSlice>, who: string): PieData {
  const target = data.slices[slice];
  if (target === undefined) throw new Error(`${who}: the pie holds no slice ${slice}`);
  if (Object.entries(change).every(([k, v]) => target[k as keyof PieSlice] === v)) return data;
  return { ...data, slices: data.slices.map((s, i) => (i === slice ? { ...s, ...change } : s)) };
}

/** `data` with slice `slice`'s value set to `value`. Throws on a slice the pie does not hold. */
export const setPieValue = (data: PieData, slice: number, value: number): PieData => withSlice(data, slice, { value }, 'setPieValue');

/** `data` with slice `slice`'s label set to `label`. Throws on a slice the pie does not hold. */
export const setPieLabel = (data: PieData, slice: number, label: string): PieData => withSlice(data, slice, { label }, 'setPieLabel');

/** A value as typed into the legend, its brackets optional: a non-negative number, else `null`. */
export function pieValueOf(text: string): number | null {
  const bare = text.trim().replace(/^\[\s*(.*?)\s*\]$/, '$1');
  if (!/^\+?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(bare)) return null;
  const value = Number(bare);
  return Number.isFinite(value) ? value : null;
}
