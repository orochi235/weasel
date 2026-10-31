/**
 * A chart's data as a host sees it to build a form or a grid: fields set once
 * per chart, and tables of rows, some holding further tables under each row.
 * Every read and write goes through the kind's own edits, so a host needs to
 * know no kind to author one.
 */
import type { PlotData } from '../plotData';

/** What a field or cell holds; `undefined` for one left unset. */
export type PlotValue = string | number | boolean | undefined;

/** What a field or cell takes, and so the control a host gives it. */
export type PlotValueType =
  | { kind: 'string'; placeholder?: string }
  | { kind: 'number'; min?: number; max?: number; step?: number }
  | { kind: 'boolean' }
  | { kind: 'enum'; options: readonly string[] }
  | { kind: 'color' };

/** Where a nested table sits: the row it hangs under in each table above it, outermost first. `[]` for a top-level table. */
export type PlotScope = readonly number[];

/** One value per chart: a title, an axis's end, an option. */
export interface PlotField<D extends PlotData = PlotData> {
  key: string;
  label: string;
  type: PlotValueType;
  /** May be left unset: setting `undefined` clears it, and the chart falls back to a default. */
  optional?: boolean;
  /** Whether the field means anything for `data` as it stands (a range axis's ends, only on a range axis). Absent, always. */
  applies?(data: D): boolean;
  get(data: D): PlotValue;
  /** `data` with the field set to `value`; `data` itself when that changes nothing or does not read. */
  set(data: D, value: PlotValue): D;
}

/** One column of a table. */
export interface PlotColumn<D extends PlotData = PlotData> {
  key: string;
  label: string;
  type: PlotValueType;
  /** May be left unset; see {@link PlotField.optional}. */
  optional?: boolean;
  /** Shown and never set: a value derived from others. */
  readOnly?: boolean;
  /** Whether the column means anything on this row (a commit's message, not a checkout's). Absent, every row. */
  applies?(data: D, scope: PlotScope, row: number): boolean;
  get(data: D, scope: PlotScope, row: number): PlotValue;
  /** `data` with the cell set to `value`; `data` itself when that changes nothing or does not read. */
  set(data: D, scope: PlotScope, row: number, value: PlotValue): D;
}

/** A collection a chart holds: slices, series, tasks, links. Each missing edit is one the collection does not allow. */
export interface PlotTable<D extends PlotData = PlotData> {
  key: string;
  label: string;
  /** What one row is called, for a button or a handle's name: `'slice'`. */
  item: string;
  count(data: D, scope: PlotScope): number;
  columns(data: D, scope: PlotScope): readonly PlotColumn<D>[];
  /** `data` with a new row before row `at`; `at` equal to the count appends. */
  insert?(data: D, scope: PlotScope, at: number): D;
  remove?(data: D, scope: PlotScope, row: number): D;
  /** `data` with row `from` moved to index `to`, counted once it is taken out. */
  move?(data: D, scope: PlotScope, from: number, to: number): D;
  /** What row `row` is called, for a heading over its nested tables. */
  rowLabel?(data: D, scope: PlotScope, row: number): string;
  /** Tables held under each row of this one; their scope is this one's with the row appended. */
  children?: readonly PlotTable<D>[];
}

/** A chart kind's data, as fields and tables. */
export interface PlotSchema<D extends PlotData = PlotData> {
  fields: readonly PlotField<D>[];
  tables: readonly PlotTable<D>[];
}
