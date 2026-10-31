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

export {
  markSpecs, plotMarkId, plotMarkOf, plotRootOf, plotRootsIn, plotSpecs, replacePlotData,
  type PlotRootData, type PlotRootTrait, type PlotSceneData, type PlotSpec, type PlotSpecsOptions, type ReplacePlotOptions,
} from './plotScene';

export { plotEditorOf, type PlotEditor, type PlotHandle } from './editing/editors';
export {
  PLOT_HANDLE_AFFORDANCE_KIND, PLOT_HANDLE_LAYER_ID, plotHandleLayer, plotHandles, plotHandleScratchOf, plotOrigin,
  type PlotHandleScratch,
} from './editing/handleLayer';
export { PLOT_DRAG_ACTION_ID, commitPlotToScene, createPlotDragAction, type PlotDragOptions, type PlotEdit } from './editing/dragAction';
export { GRAB_PLOT_HANDLE_ACTION_ID, plotEditing } from './editing/plotEditing';
export { PlotView, type PlotViewProps } from './PlotView';
