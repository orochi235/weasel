/** A pie as fields and one table of slices. */
import { numberOf, textOf, titleField } from '../editing/schemaKit';
import type { PlotSchema } from '../editing/schemaTypes';
import { setPieLabel, setPieValue } from './edit';
import { insertPieSlice, movePieSlice, removePieSlice, setPieShowData } from './structure';
import type { PieData } from './types';

export const pieSchema: PlotSchema<PieData> = {
  fields: [
    titleField(),
    {
      key: 'showData', label: 'Show values', type: { kind: 'boolean' },
      get: (d) => d.showData ?? false,
      set: (d, v) => (typeof v === 'boolean' ? setPieShowData(d, v) : d),
    },
  ],
  tables: [{
    key: 'slices', label: 'Slices', item: 'slice',
    count: (d) => d.slices.length,
    columns: () => [
      {
        key: 'label', label: 'Label', type: { kind: 'string' },
        get: (d, _, r) => d.slices[r]?.label,
        set: (d, _, r, v) => { const t = textOf(v)?.trim(); return t ? setPieLabel(d, r, t) : d; },
      },
      {
        key: 'value', label: 'Value', type: { kind: 'number', min: 0 },
        get: (d, _, r) => d.slices[r]?.value,
        set: (d, _, r, v) => { const n = numberOf(v); return n !== undefined && n >= 0 ? setPieValue(d, r, n) : d; },
      },
    ],
    insert: (d, _, at) => insertPieSlice(d, at),
    remove: (d, _, r) => removePieSlice(d, r),
    move: (d, _, from, to) => movePieSlice(d, from, to),
    rowLabel: (d, _, r) => d.slices[r]?.label ?? '',
  }],
};
