/** Chart specs, and the one table that compiles each kind to marks. */
import { compileGantt } from './gantt/compile';
import type { GanttData } from './gantt/types';
import { compileGitGraph } from './gitgraph/compile';
import type { GitGraphData } from './gitgraph/types';
import { compileJourney } from './journey/compile';
import type { JourneyData } from './journey/types';
import type { PlotMark } from './marks/types';
import type { PlotMeasure } from './measure';
import { compilePacket } from './packet/compile';
import type { PacketData } from './packet/types';
import { compilePie } from './pie/compile';
import type { PieData } from './pie/types';
import { compileQuadrant } from './quadrant/compile';
import type { QuadrantData } from './quadrant/types';
import { compileRadar } from './radar/compile';
import type { RadarData } from './radar/types';
import { compileSankey } from './sankey/compile';
import type { SankeyData } from './sankey/types';
import type { PlotTheme } from './theme';
import { compileTimeline } from './timeline/compile';
import type { TimelineData } from './timeline/types';
import { compileXyChart } from './xychart/compile';
import type { XyChartData } from './xychart/types';

/** A chart, as data: one spec per kind, told apart by `kind`. */
export type PlotData =
  | XyChartData | GanttData | TimelineData | PieData | QuadrantData | JourneyData | GitGraphData | SankeyData | PacketData | RadarData;

/** The kinds of chart {@link PlotData} holds. */
export type PlotKind = PlotData['kind'];

/** What a kind's compiler is given and gives back: its spec laid out in a box of `size`, as marks. */
export type PlotCompiler<D extends PlotData> = (
  data: D, size: { width: number; height: number }, theme: PlotTheme, measure: PlotMeasure,
) => { marks: PlotMark[] };

const COMPILERS: { readonly [K in PlotKind]: PlotCompiler<Extract<PlotData, { kind: K }>> } = {
  xychart: compileXyChart,
  gantt: compileGantt,
  timeline: compileTimeline,
  pie: compilePie,
  quadrant: compileQuadrant,
  journey: compileJourney,
  gitgraph: compileGitGraph,
  sankey: compileSankey,
  packet: compilePacket,
  radar: compileRadar,
};

/** `data` laid out in a box of `size`, as the marks it is drawn with, in drawing order. */
export function compilePlot(
  data: PlotData, size: { width: number; height: number }, theme: PlotTheme, measure: PlotMeasure,
): PlotMark[] {
  const compile = COMPILERS[data.kind] as PlotCompiler<PlotData> | undefined;
  if (compile === undefined) throw new Error(`compilePlot: no chart of kind "${(data as { kind: string }).kind}"`);
  return compile(data, size, theme, measure).marks;
}
