/** A journey compiled to its scales and marks. */
import type { PlotMark } from '../marks/types';
import type { PlotMeasure } from '../measure';
import type { PlotTheme } from '../theme';
import type { JourneyData } from './types';

/** STUB: replaced by the kind's real compiler. */
export function compileJourney(
  _data: JourneyData, _size: { width: number; height: number }, _theme: PlotTheme, _measure: PlotMeasure,
): { marks: PlotMark[] } {
  return { marks: [] };
}
