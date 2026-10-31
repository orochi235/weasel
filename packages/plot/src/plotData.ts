/** Chart specs, and the one table that compiles each kind to marks. */
import type { PlotMark } from './marks/types';
import type { PlotMeasure } from './measure';
import type { PlotTheme } from './theme';
import { compileXyChart } from './xychart/compile';
import type { XyChartData } from './xychart/types';

/** A chart, as data: one spec per kind, told apart by `kind`. */
export type PlotData = XyChartData;

/** The kinds of chart {@link PlotData} holds. */
export type PlotKind = PlotData['kind'];

/** What a kind's compiler is given and gives back: its spec laid out in a box of `size`, as marks. */
export type PlotCompiler<D extends PlotData> = (
  data: D, size: { width: number; height: number }, theme: PlotTheme, measure: PlotMeasure,
) => { marks: PlotMark[] };

const COMPILERS: { readonly [K in PlotKind]: PlotCompiler<Extract<PlotData, { kind: K }>> } = {
  xychart: compileXyChart,
};

/** `data` laid out in a box of `size`, as the marks it is drawn with, in drawing order. */
export function compilePlot(
  data: PlotData, size: { width: number; height: number }, theme: PlotTheme, measure: PlotMeasure,
): PlotMark[] {
  const compile = COMPILERS[data.kind] as PlotCompiler<PlotData> | undefined;
  if (compile === undefined) throw new Error(`compilePlot: no chart of kind "${(data as { kind: string }).kind}"`);
  return compile(data, size, theme, measure).marks;
}
