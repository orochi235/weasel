/**
 * @weasel-js/text — typography: styled runs, style resolution, kerned glyph
 * layout, wrap and measurement. Glyphs come from `@weasel-js/font`; nothing
 * here knows about a scene graph, a renderer or React.
 */

export {
  toRuns,
  runsToPlainText,
  runsToMarkdown,
  markdownToRuns,
  MARKDOWN_RUN_GRAMMAR,
} from './runs';
export type { StyledRun, RunGrammar, RunMarker, RunFlag } from './runs';

export {
  DEFAULT_TEXT_STYLE,
  resolveTextStyle,
  resolveAlign,
  fontString,
} from './textStyle';
export type {
  TextStyle, TextPaint, ResolvedTextStyle, TextAlign, TextDirection,
} from './textStyle';

export {
  resolveRuns, SCRIPT_METRICS, scriptMetrics, scriptMetricsFor, numericWeight, isBoldWeight,
} from './runs/resolveRuns';
export type { ResolvedRun, ScriptPreset } from './runs/resolveRuns';
export { DEFAULT_DECORATION_METRICS, decorationMetrics } from './layout/decorationMetrics';
export type { DecorationKind } from './layout/decorationMetrics';
export { transformRunTexts } from './runs/textTransform';
export type { TextTransform, RunSourceMap, TransformedRunText } from './runs/textTransform';
export {
  SMALL_CAPS_SCALE, smallCapsScale, smallCapsScaleFor, smallCapsText, isSmallCapsLetter,
} from './runs/smallCaps';
export type { FontVariantCaps, SmallCapsText } from './runs/smallCaps';

export { layoutRuns } from './layout/layoutRuns';
export {
  lineBreakOpportunities, NO_BREAK, BREAK_ALLOWED, BREAK_MANDATORY,
} from './layout/lineBreak/lineBreaks';
export {
  cachedLayoutRuns,
  LAYOUT_CACHE_VARIANT_LIMIT,
  LAYOUT_CACHE_STRUCTURAL_LIMIT,
} from './layout/layoutCache';
export { layoutTextPose, textPoseLayoutInput } from './layout/textPoseLayout';
export type { TextPoseLayout, TextPoseLayoutInput } from './layout/textPoseLayout';
export type { BidiResolver, BidiReordering, BidiAnalysis } from './layout/bidiSeam';
export type {
  LayoutRunsOpts,
  LaidOutRuns,
  LaidOutGroup,
  LaidOutQuad,
  LaidOutOutlineGlyph,
  LaidOutDecoration,
  LaidOutLineBox,
  LaidOutCell,
} from './layout/layoutRuns';

export { measureText, measuredWidth } from './measure/measureText';
export type { MeasuredText } from './measure/measureText';
export { measureTextBounds } from './measure/measureTextBounds';
export type { MeasureTextBoundsOpts } from './measure/measureTextBounds';
export { textLineBoxes } from './measure/lineBoxes';
export type { TextLineBoxesOpts } from './measure/lineBoxes';
export { verticalAlignOffset } from './measure/verticalAlign';
export type { TextVerticalAlign } from './measure/verticalAlign';

export type { TextPose } from './pose';

export { createMarkdownRenderer, layoutMarkdown } from './markdownText';
export type {
  MarkdownFontOptions,
  MeasureFn,
  FaceMetricsFn,
  PositionedRun,
  LayoutLine,
  LayoutResult,
  TextRenderer,
} from './markdownText';
