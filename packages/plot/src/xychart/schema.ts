/** An xychart as fields for its axes, a table of rows holding a value of each series, and a table of the series. */
import { choiceOf, numberOf, textOf, titleField } from '../editing/schemaKit';
import type { PlotColumn, PlotField, PlotSchema } from '../editing/schemaTypes';
import { setXyValue, xyRows } from './edit';
import {
  insertXyRow, insertXySeries, moveXyRow, moveXySeries, removeXyRow, removeXySeries, setXyAxisTitle, setXyCategory, setXyOrientation,
  setXyRangeBound, setXySeriesKind, setXySeriesName, setXyValueBound, setXyXKind,
} from './structure';
import type { XyChartData } from './types';

const isRange = (d: XyChartData): boolean => d.x?.kind === 'range';
const X_KINDS = ['categories', 'range'] as const;

const rangeField = (end: 'min' | 'max', label: string): PlotField<XyChartData> => ({
  key: `x.${end}`, label, type: { kind: 'number' }, applies: isRange,
  get: (d) => (d.x?.kind === 'range' ? d.x[end] : undefined),
  set: (d, v) => { const n = numberOf(v); return n !== undefined && isRange(d) ? setXyRangeBound(d, end, n) : d; },
});

const boundField = (end: 'min' | 'max', label: string): PlotField<XyChartData> => ({
  key: `y.${end}`, label, type: { kind: 'number' }, optional: true,
  get: (d) => d.y?.[end],
  set: (d, v) => (v === undefined || numberOf(v) !== undefined ? setXyValueBound(d, end, numberOf(v)) : d),
});

const axisTitle = (axis: 'x' | 'y', label: string): PlotField<XyChartData> => ({
  key: `${axis}.title`, label, type: { kind: 'string' }, optional: true,
  get: (d) => d[axis]?.title,
  set: (d, v) => (v === undefined || typeof v === 'string' ? setXyAxisTitle(d, axis, v) : d),
});

const categoryColumn: PlotColumn<XyChartData> = {
  key: 'category', label: 'Category', type: { kind: 'string' },
  applies: (d) => !isRange(d),
  get: (d, _, r) => (d.x?.kind === 'band' ? d.x.categories[r] ?? String(r + 1) : isRange(d) ? undefined : String(r + 1)),
  set: (d, _, r, v) => { const t = textOf(v)?.trim(); return t && !isRange(d) ? setXyCategory(d, r, t) : d; },
};

const valueColumn = (d: XyChartData, series: number): PlotColumn<XyChartData> => ({
  key: `series.${series}`, label: d.series[series]?.name ?? `Series ${series + 1}`, type: { kind: 'number' },
  get: (data, _, r) => data.series[series]?.values[r] ?? 0,
  set: (data, _, r, v) => { const n = numberOf(v); return n !== undefined ? setXyValue(data, series, r, n) : data; },
});

export const xySchema: PlotSchema<XyChartData> = {
  fields: [
    titleField(),
    {
      key: 'orientation', label: 'Orientation', type: { kind: 'enum', options: ['vertical', 'horizontal'] },
      get: (d) => d.orientation ?? 'vertical',
      set: (d, v) => { const o = choiceOf(v, ['vertical', 'horizontal'] as const); return o ? setXyOrientation(d, o) : d; },
    },
    {
      key: 'x.kind', label: 'X axis', type: { kind: 'enum', options: X_KINDS },
      get: (d) => (isRange(d) ? 'range' : 'categories'),
      set: (d, v) => { const k = choiceOf(v, X_KINDS); return k ? setXyXKind(d, k === 'range' ? 'range' : 'band') : d; },
    },
    axisTitle('x', 'X title'),
    rangeField('min', 'X from'),
    rangeField('max', 'X to'),
    axisTitle('y', 'Y title'),
    boundField('min', 'Y from'),
    boundField('max', 'Y to'),
  ],
  tables: [
    {
      key: 'rows', label: 'Data', item: 'row',
      count: xyRows,
      columns: (d) => [categoryColumn, ...d.series.map((_, i) => valueColumn(d, i))],
      insert: (d, _, at) => insertXyRow(d, at),
      remove: (d, _, r) => removeXyRow(d, r),
      move: (d, _, from, to) => moveXyRow(d, from, to),
      rowLabel: (d, _, r) => String(categoryColumn.get(d, [], r) ?? r + 1),
    },
    {
      key: 'series', label: 'Series', item: 'series',
      count: (d) => d.series.length,
      columns: () => [
        {
          key: 'name', label: 'Name', type: { kind: 'string' }, optional: true,
          get: (d, _, r) => d.series[r]?.name,
          set: (d, _, r, v) => (v === undefined || typeof v === 'string' ? setXySeriesName(d, r, v) : d),
        },
        {
          key: 'kind', label: 'Drawn as', type: { kind: 'enum', options: ['bar', 'line'] },
          get: (d, _, r) => d.series[r]?.kind,
          set: (d, _, r, v) => { const k = choiceOf(v, ['bar', 'line'] as const); return k ? setXySeriesKind(d, r, k) : d; },
        },
      ],
      insert: (d, _, at) => insertXySeries(d, at),
      remove: (d, _, r) => removeXySeries(d, r),
      move: (d, _, from, to) => moveXySeries(d, from, to),
      rowLabel: (d, _, r) => d.series[r]?.name ?? `Series ${r + 1}`,
    },
  ],
};
