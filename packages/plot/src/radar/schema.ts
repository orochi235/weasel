/** A radar as its options, a table of axes holding a value of each curve, and a table of the curves. */
import { choiceOf, integerOf, numberOf, textOf, titleField } from '../editing/schemaKit';
import type { PlotColumn, PlotField, PlotSchema } from '../editing/schemaTypes';
import { setRadarAxisLabel, setRadarCurveLabel, setRadarValue } from './edit';
import {
  insertRadarAxis, insertRadarCurve, moveRadarAxis, moveRadarCurve, removeRadarAxis, removeRadarCurve, setRadarAxisId, setRadarCurveId,
  setRadarOption,
} from './structure';
import type { RadarData } from './types';

const ID = /^\w+$/;

const bound = (key: 'min' | 'max', label: string): PlotField<RadarData> => ({
  key, label, type: { kind: 'number' }, optional: true,
  get: (d) => d[key],
  set: (d, v) => (v === undefined || numberOf(v) !== undefined ? setRadarOption(d, key, numberOf(v)) : d),
});

/** The id and label columns of the axes or the curves. */
function named(
  list: (d: RadarData) => readonly { id: string; label?: string }[],
  setId: (d: RadarData, r: number, id: string) => RadarData,
  setLabel: (d: RadarData, r: number, text: string) => RadarData,
): PlotColumn<RadarData>[] {
  return [
    {
      key: 'id', label: 'Id', type: { kind: 'string' },
      get: (d, _, r) => list(d)[r]?.id,
      set: (d, _, r, v) => {
        const id = textOf(v)?.trim() ?? '';
        return ID.test(id) && !list(d).some((x, i) => i !== r && x.id === id) ? setId(d, r, id) : d;
      },
    },
    {
      key: 'label', label: 'Label', type: { kind: 'string' }, optional: true,
      get: (d, _, r) => list(d)[r]?.label,
      set: (d, _, r, v) => (v === undefined || typeof v === 'string' ? setLabel(d, r, v ?? '') : d),
    },
  ];
}

const valueColumn = (d: RadarData, curve: number): PlotColumn<RadarData> => ({
  key: `curve.${curve}`, label: d.curves[curve]?.label ?? d.curves[curve]?.id ?? `Curve ${curve + 1}`, type: { kind: 'number' },
  get: (data, _, r) => data.curves[curve]?.values[r] ?? 0,
  set: (data, _, r, v) => { const n = numberOf(v); return n !== undefined ? setRadarValue(data, curve, r, n) : data; },
});

export const radarSchema: PlotSchema<RadarData> = {
  fields: [
    titleField(),
    bound('min', 'Center value'),
    bound('max', 'Rim value'),
    {
      key: 'graticule', label: 'Graticule', type: { kind: 'enum', options: ['circle', 'polygon'] },
      get: (d) => d.graticule ?? 'circle',
      set: (d, v) => { const g = choiceOf(v, ['circle', 'polygon'] as const); return g ? setRadarOption(d, 'graticule', g === 'circle' ? undefined : g) : d; },
    },
    {
      key: 'ticks', label: 'Rings', type: { kind: 'number', min: 1, step: 1 }, optional: true,
      get: (d) => d.ticks,
      set: (d, v) => { const n = integerOf(v); return v === undefined || (n !== undefined && n >= 1) ? setRadarOption(d, 'ticks', n) : d; },
    },
    {
      key: 'showLegend', label: 'Legend', type: { kind: 'boolean' },
      get: (d) => d.showLegend ?? true,
      set: (d, v) => (typeof v === 'boolean' ? setRadarOption(d, 'showLegend', v ? undefined : false) : d),
    },
  ],
  tables: [
    {
      key: 'axes', label: 'Axes', item: 'axis',
      count: (d) => d.axes.length,
      columns: (d) => [
        ...named((data) => data.axes, setRadarAxisId, setRadarAxisLabel),
        ...d.curves.map((_, i) => valueColumn(d, i)),
      ],
      insert: (d, _, at) => insertRadarAxis(d, at),
      remove: (d, _, r) => removeRadarAxis(d, r),
      move: (d, _, from, to) => moveRadarAxis(d, from, to),
      rowLabel: (d, _, r) => d.axes[r]?.label ?? d.axes[r]?.id ?? '',
    },
    {
      key: 'curves', label: 'Curves', item: 'curve',
      count: (d) => d.curves.length,
      columns: () => named((data) => data.curves, setRadarCurveId, setRadarCurveLabel),
      insert: (d, _, at) => insertRadarCurve(d, at),
      remove: (d, _, r) => removeRadarCurve(d, r),
      move: (d, _, from, to) => moveRadarCurve(d, from, to),
      rowLabel: (d, _, r) => d.curves[r]?.label ?? d.curves[r]?.id ?? '',
    },
  ],
};
