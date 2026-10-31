/** What every kind's schema is built from: reading a {@link PlotValue} as the type a field holds, and the title field. */
import { withTitle } from '../chartTitle';
import type { PlotData } from '../plotData';
import type { PlotField, PlotValue } from './schemaTypes';

/** `v` as text, or `undefined` for anything else. */
export const textOf = (v: PlotValue): string | undefined => (typeof v === 'string' ? v : undefined);

/** `v` as a finite number, or `undefined` for anything else. */
export const numberOf = (v: PlotValue): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** `v` as a whole number, or `undefined` for anything else. */
export const integerOf = (v: PlotValue): number | undefined => {
  const n = numberOf(v);
  return n !== undefined && Number.isInteger(n) ? n : undefined;
};

/** `v` when it is one of `options`, else `undefined`. */
export const choiceOf = <T extends string>(v: PlotValue, options: readonly T[]): T | undefined =>
  (options as readonly PlotValue[]).includes(v) ? v as T : undefined;

/** A list written with commas, as its trimmed, non-empty items. */
export const listOf = (text: string): string[] => text.split(',').map((s) => s.trim()).filter((s) => s !== '');

/** The chart's title, which every kind takes. */
export const titleField = <D extends PlotData>(): PlotField<D> => ({
  key: 'title',
  label: 'Title',
  type: { kind: 'string' },
  optional: true,
  get: (data) => data.title,
  set: (data, v) => (v === undefined || typeof v === 'string' ? withTitle(data, v ?? '') : data),
});
