/** A pie's edits: its title, slice labels and values, each typed in place. */
import { withTitle } from '../chartTitle';
import type { PlotEditor } from '../editing/editors';
import { pieValueOf, setPieLabel, setPieValue } from './edit';
import type { PieData } from './types';

/** No drags; the title, a slice's label and, with `showData`, its value take a text edit. */
export const pieEditor: PlotEditor<PieData> = {
  handle: () => null,
  drag: () => null,
  text(data, datum, text) {
    if (datum.edit === 'title') return withTitle(data, text);
    const slice = datum.slice;
    if (typeof slice !== 'number' || data.slices[slice] === undefined) return data;
    if (datum.edit === 'label') {
      const label = text.trim();
      return label === '' ? data : setPieLabel(data, slice, label);
    }
    if (datum.edit === 'value') {
      const value = pieValueOf(text);
      return value === null ? data : setPieValue(data, slice, value);
    }
    return data;
  },
};
