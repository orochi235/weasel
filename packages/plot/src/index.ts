/**
 * `@weasel-js/plot` — charts on weasel's scene graph. The lower layer is
 * scales, axes and marks, each mark keeping the datum it draws; the upper is
 * chart specs (`PlotData`) that `plotSpecs` compiles to one root node holding
 * the spec and its marks under it, edited by dragging the marks.
 *
 * @packageDocumentation
 */
export type { Scale, ContinuousScale } from './scales/types';
export { linearScale, niceDomain, tickStep, stepTicks, formatNumber, type LinearScale, type LinearScaleOptions } from './scales/linear';
export { logScale, type LogScale, type LogScaleOptions } from './scales/log';
export { bandScale, type BandScale, type BandScaleOptions } from './scales/band';
export { timeScale, formatInstant, type TimeScale, type TimeScaleOptions } from './scales/time';
export { ordinalScale, type OrdinalScale, type OrdinalScaleOptions } from './scales/ordinal';
export { polarScale, type PolarScale, type PolarScaleOptions } from './scales/polar';

export type {
  MarkKind, PlotBox, PlotDatum, PlotMark, PlotMarkData, PlotMarkTrait, PlotPoint, SolidFill, SolidStroke,
} from './marks/types';
export { barMark, spanMark, pointMark, type BarMarkOptions, type SpanMarkOptions, type PointMarkOptions } from './marks/boxes';
export {
  lineMark, ruleMark, areaMark, arcMark, ribbonMark,
  type LineMarkOptions, type RuleMarkOptions, type AreaMarkOptions, type ArcMarkOptions, type RibbonMarkOptions,
} from './marks/paths';
export { textMark, type TextMarkOptions } from './marks/text';
export { axisMarks, axisRoom, type AxisOptions, type AxisSide } from './axes';

export { PLOT_FONT, PLOT_THEME, plotThemeFrom, seriesColor, type PlotFont, type PlotTheme } from './theme';
export { textMeasure, type PlotMeasure } from './measure';

export { compilePlot, type PlotCompiler, type PlotData, type PlotKind } from './plotData';
export type { XyBandAxis, XyChartData, XyRangeAxis, XySeries, XyValueAxis } from './xychart/types';
export { compileXyChart, xyLength, xyValueDomain, type XyLayout } from './xychart/compile';
export { setXyValue, xyValueAt } from './xychart/edit';
export type { GanttData, GanttEnd, GanttSection, GanttStart, GanttTag, GanttTask, GanttUnit } from './gantt/types';
export { compileGantt, type GanttLayout } from './gantt/compile';
export { scheduleGantt, type GanttSchedule, type GanttSpan } from './gantt/schedule';
export { GANTT_DATE_FORMAT, formatGanttDate, parseGanttDate } from './gantt/dates';
export { moveGanttTask, setGanttEnd, setGanttSectionName, setGanttTaskName } from './gantt/edit';
export type { TimelineData, TimelinePeriod, TimelineSection } from './timeline/types';
export { compileTimeline, type TimelineLayout } from './timeline/compile';
export {
  moveTimelinePeriod, setTimelineEvent, setTimelinePeriodLabel, setTimelineSectionName,
} from './timeline/edit';
export type { PieData, PieSlice } from './pie/types';
export { compilePie, type PieLayout } from './pie/compile';
export { setPieLabel, setPieValue } from './pie/edit';
export type { QuadrantAxis, QuadrantData, QuadrantPoint, QuadrantPointStyle } from './quadrant/types';
export { compileQuadrant, type QuadrantLayout } from './quadrant/compile';
export { setQuadrantAxisLabel, setQuadrantLabel, setQuadrantPoint, setQuadrantPointName } from './quadrant/edit';
export type { JourneyData, JourneySection, JourneyTask } from './journey/types';
export { compileJourney, type JourneyLayout } from './journey/compile';
export { setJourneyScore, setJourneySectionName, setJourneyTaskName } from './journey/edit';
export type { GitCommand, GitCommitType, GitGraphData } from './gitgraph/types';
export { compileGitGraph, type GitGraphLayout } from './gitgraph/compile';
export { replayGitGraph, type GitBranch, type GitCommit, type GitHistory } from './gitgraph/replay';
export { setGitTag } from './gitgraph/edit';
export type { SankeyData, SankeyLink } from './sankey/types';
export { compileSankey } from './sankey/compile';
export { sankeyLayout, type SankeyLayout, type SankeyNodeBox, type SankeyRibbon } from './sankey/layout';
export { renameSankeyNode, setSankeyValue } from './sankey/edit';
export type { PacketData, PacketField } from './packet/types';
export { compilePacket, type PacketLayout, type PacketPiece } from './packet/compile';
export { setPacketLabel } from './packet/edit';
export type { RadarAxis, RadarCurve, RadarData } from './radar/types';
export { compileRadar, type RadarLayout } from './radar/compile';
export { setRadarAxisLabel, setRadarCurveLabel, setRadarValue } from './radar/edit';
export { CHART_PAD, chartTitle, withTitle } from './chartTitle';

export {
  markSpecs, plotMarkId, plotMarkOf, plotRootOf, plotRootsIn, plotSpecs, replacePlotData,
  type PlotRootData, type PlotRootTrait, type PlotSceneData, type PlotSpec, type PlotSpecsOptions, type ReplacePlotOptions,
} from './plotScene';

export { handlesOf, plotEditorOf, type PlotEditor, type PlotHandle } from './editing/editors';
export { foldPlotText, isPlotText, plotTextOf, usePlotTextEdit } from './editing/textEdit';
export {
  PLOT_HANDLE_AFFORDANCE_KIND, PLOT_HANDLE_LAYER_ID, plotHandleLayer, plotHandles, plotHandleScratchOf, plotOrigin,
  type PlotHandleScratch,
} from './editing/handleLayer';
export { PLOT_DRAG_ACTION_ID, commitPlotToScene, createPlotDragAction, type PlotDragOptions, type PlotEdit } from './editing/dragAction';
export { GRAB_PLOT_HANDLE_ACTION_ID, plotEditing } from './editing/plotEditing';
export { PlotView, type PlotViewProps } from './PlotView';
