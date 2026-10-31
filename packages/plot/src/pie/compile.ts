/** A pie compiled to its scales and marks. */
import type { PlotMark } from '../marks/types';
import type { PlotMeasure } from '../measure';
import type { PlotTheme } from '../theme';
import type { PieData } from './types';

/** STUB: replaced by the kind's real compiler. */
export function compilePie(
  _data: PieData, _size: { width: number; height: number }, _theme: PlotTheme, _measure: PlotMeasure,
): { marks: PlotMark[] } {
  return { marks: [] };
}
