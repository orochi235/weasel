/** A quadrant chart as fields for its axes and quadrant labels, a table of points, and a table of named styles. */
import { numberOf, textOf, titleField } from '../editing/schemaKit';
import type { PlotColumn, PlotField, PlotSchema } from '../editing/schemaTypes';
import { setQuadrantAxisLabel, setQuadrantLabel, setQuadrantPoint, setQuadrantPointName } from './edit';
import {
  insertQuadrantClass, insertQuadrantPoint, moveQuadrantClass, moveQuadrantPoint, quadrantClassNames, removeQuadrantClass,
  removeQuadrantPoint, renameQuadrantClass, setQuadrantClassStyle, setQuadrantPointClass, setQuadrantPointStyle,
} from './structure';
import type { QuadrantData, QuadrantPointStyle } from './types';

const axisField = (axis: 'x' | 'y', end: 'low' | 'high', label: string): PlotField<QuadrantData> => ({
  key: `${axis}.${end}`, label, type: { kind: 'string' }, optional: true,
  get: (d) => d[axis]?.[end],
  set: (d, v) => (v === undefined || typeof v === 'string' ? setQuadrantAxisLabel(d, axis, end, v?.trim() ?? '') : d),
});

const quadrantField = (n: number, label: string): PlotField<QuadrantData> => ({
  key: `quadrant.${n}`, label, type: { kind: 'string' }, optional: true,
  get: (d) => d.quadrants?.[n - 1],
  set: (d, v) => (v === undefined || typeof v === 'string' ? setQuadrantLabel(d, n, v?.trim() ?? '') : d),
});

const STYLE: readonly { key: keyof QuadrantPointStyle; label: string; color: boolean }[] = [
  { key: 'radius', label: 'Radius', color: false },
  { key: 'color', label: 'Color', color: true },
  { key: 'strokeColor', label: 'Stroke', color: true },
  { key: 'strokeWidth', label: 'Stroke width', color: false },
];

/** A style's columns, read and written on whatever `styleOf` and `restyle` reach. */
const styleColumns = (
  styleOf: (d: QuadrantData, row: number) => QuadrantPointStyle | undefined,
  restyle: (d: QuadrantData, row: number, key: keyof QuadrantPointStyle, value: string | number | undefined) => QuadrantData,
): PlotColumn<QuadrantData>[] => STYLE.map(({ key, label, color }) => ({
  key, label, optional: true, type: color ? { kind: 'color' } : { kind: 'number', min: 0 },
  get: (d, _, r) => styleOf(d, r)?.[key],
  set: (d, _, r, v) => {
    if (v === undefined) return restyle(d, r, key, undefined);
    const value = color ? textOf(v) : numberOf(v);
    return value === undefined || (typeof value === 'number' && value < 0) ? d : restyle(d, r, key, value);
  },
}));

const unit = (axis: 'x' | 'y', label: string): PlotColumn<QuadrantData> => ({
  key: axis, label, type: { kind: 'number', min: 0, max: 1, step: 0.01 },
  get: (d, _, r) => d.points[r]?.[axis],
  set: (d, _, r, v) => {
    const n = numberOf(v);
    const p = d.points[r];
    return n === undefined || n < 0 || n > 1 || p === undefined ? d : setQuadrantPoint(d, r, { x: p.x, y: p.y, [axis]: n });
  },
});

export const quadrantSchema: PlotSchema<QuadrantData> = {
  fields: [
    titleField(),
    axisField('x', 'low', 'X low'), axisField('x', 'high', 'X high'),
    axisField('y', 'low', 'Y low'), axisField('y', 'high', 'Y high'),
    quadrantField(1, 'Top right'), quadrantField(2, 'Top left'), quadrantField(3, 'Bottom left'), quadrantField(4, 'Bottom right'),
  ],
  tables: [
    {
      key: 'points', label: 'Points', item: 'point',
      count: (d) => d.points.length,
      columns: (d) => [
        {
          key: 'name', label: 'Name', type: { kind: 'string' },
          get: (data, _, r) => data.points[r]?.name,
          set: (data, _, r, v) => { const t = textOf(v)?.trim(); return t ? setQuadrantPointName(data, r, t) : data; },
        },
        unit('x', 'X'),
        unit('y', 'Y'),
        {
          key: 'className', label: 'Class', type: { kind: 'enum', options: quadrantClassNames(d) }, optional: true,
          get: (data, _, r) => data.points[r]?.className,
          set: (data, _, r, v) => (v === undefined || (typeof v === 'string' && data.classes?.[v] !== undefined)
            ? setQuadrantPointClass(data, r, v as string | undefined) : data),
        },
        ...styleColumns((data, r) => data.points[r]?.style, (data, r, key, v) => setQuadrantPointStyle(data, r, key, v as never)),
      ],
      insert: (d, _, at) => insertQuadrantPoint(d, at),
      remove: (d, _, r) => removeQuadrantPoint(d, r),
      move: (d, _, from, to) => moveQuadrantPoint(d, from, to),
      rowLabel: (d, _, r) => d.points[r]?.name ?? '',
    },
    {
      key: 'classes', label: 'Classes', item: 'class',
      count: (d) => quadrantClassNames(d).length,
      columns: () => [
        {
          key: 'name', label: 'Name', type: { kind: 'string' },
          get: (d, _, r) => quadrantClassNames(d)[r],
          set: (d, _, r, v) => {
            const name = textOf(v)?.trim() ?? '';
            return /^\w+$/.test(name) && !quadrantClassNames(d).includes(name) ? renameQuadrantClass(d, r, name) : d;
          },
        },
        ...styleColumns((d, r) => Object.values(d.classes ?? {})[r], (d, r, key, v) => setQuadrantClassStyle(d, r, key, v as never)),
      ],
      insert: (d, _, at) => insertQuadrantClass(d, at),
      remove: (d, _, r) => removeQuadrantClass(d, r),
      move: (d, _, from, to) => moveQuadrantClass(d, from, to),
      rowLabel: (d, _, r) => quadrantClassNames(d)[r] ?? '',
    },
  ],
};
