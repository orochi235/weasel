/** A radar compiled to its scales and marks. */
import type { PlotMark } from '../marks/types';
import type { PlotMeasure } from '../measure';
import type { PlotTheme } from '../theme';
import type { RadarData } from './types';

/** STUB: replaced by the kind's real compiler. */
export function compileRadar(
  _data: RadarData, _size: { width: number; height: number }, _theme: PlotTheme, _measure: PlotMeasure,
): { marks: PlotMark[] } {
  return { marks: [] };
}
