/**
 * @weasel-js/text — typography: styled runs, style resolution, kerned glyph
 * layout, wrap and measurement. Glyphs come from `@weasel-js/font`; nothing
 * here knows about a scene graph, a renderer or React.
 *
 * @packageDocumentation
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
  DEFAULT_TEXT_FILL,
  resolveTextStyle,
  resolveAlign,
  fontString,
} from './textStyle';
export type {
  TextStyle, TextPaint, ResolvedTextStyle, TextAlign, TextDirection,
} from './textStyle';

export {
  resolveRuns, resolveRunFace, SCRIPT_METRICS, scriptMetrics, scriptMetricsFor, halfLeadingFor, numericWeight, isBoldWeight,
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
  lineBreakOpportunities, isHardLineBreak, NO_BREAK, BREAK_ALLOWED, BREAK_MANDATORY,
} from './layout/lineBreak/lineBreaks';
export {
  cachedLayoutRuns,
  dropRuns,
  LAYOUT_CACHE_VARIANT_LIMIT,
  LAYOUT_CACHE_STRUCTURAL_LIMIT,
} from './layout/layoutCache';
export { layoutTextPose, textPoseLayoutInput } from './layout/textPoseLayout';
export type { TextPoseLayout, TextPoseLayoutInput } from './layout/textPoseLayout';
export type { BidiResolver, BidiReordering, BidiAnalysis } from './layout/bidiSeam';
export { registerBidi, paragraphDirection } from './layout/bidiRegistry';
export type { TextShaper, ShapedGlyph, ShapedCluster } from './layout/shaperSeam';
export { registerShaper } from './layout/shaperRegistry';
export type { LayoutRunsOpts } from './layout/layoutOpts';
export type {
  LaidOutRuns,
  LaidOutLineBox,
  LaidOutCell,
  PlacedGlyph,
} from './layout/layoutRuns';
export { paintRuns } from './layout/paintRuns';
export { QUAD_STRIDE } from './layout/glyphQuads';
export type { LaidOutQuad } from './layout/glyphQuads';
export type {
  PaintRunsOpts,
  PaintedRuns,
  LaidOutGroup,
  LaidOutOutlineGlyph,
  LaidOutDecoration,
} from './layout/paintRuns';
export type { CacheUse } from './layout/layoutCache';
export { cachedPaintRuns } from './layout/paintCache';

export { measureText, measuredWidth } from './measure/measureText';
export type { MeasuredText, MeasuredSpan } from './measure/measureText';
export { measureTextBounds } from './measure/measureTextBounds';
export type { MeasureTextBoundsOpts } from './measure/measureTextBounds';
export { textLineBoxes } from './measure/lineBoxes';
export type { TextLineBoxesOpts } from './measure/lineBoxes';
export { verticalAlignOffset } from './measure/verticalAlign';
export type { TextVerticalAlign } from './measure/verticalAlign';

export type { TextPose } from './pose';
export { pointInTextPose, caretIndexAt } from './hitTest';
export type { PointInTextPoseOpts } from './hitTest';
export { fitTextPose } from './fitTextPose';
export type { FitTextPoseOptions } from './fitTextPose';
export { renderLabel, defaultLabelTextRenderer } from './renderLabel';
export type { LabelOptions } from './renderLabel';
export { isTextData } from './isTextData';

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

export { MIXED, styleAtRange, applyStyleToRange, patchRangeStyle, runsCarryStyling, supersededKey } from './runs/rangeStyle';
export type { Mixed, RangeStyle, RunStylePatch, StyleKey } from './runs/rangeStyle';
export { effectiveRangeStyle, rangeWeight } from './runs/effectiveRangeStyle';
export { setFlagOverRange, nodeHasFlag, unboldPatch } from './runs/flagRange';
export type { FlagKey, SetFlagResult } from './runs/flagRange';

export { SYNTHETIC_ITALIC_RADIANS } from './syntheticItalic';
export { glyphTurn } from './glyphTurn';
export { syntheticBoldOffset, emboldenGlyphD } from './syntheticBold';
export { glyphOutlineAt } from './glyphOutlines';
export { textToPath, textToPathsByPaint, loadTextOutlines, TextOutlinesError } from './textToPath';
export { textClusters } from './textClusters';
export type { TextCluster, TextClusterRule, TextClustersOptions } from './textClusters';
export type {
  TextOutlineSource, TextNodeSource, TextPaintPath, TextToPathOptions, TextOutlinesFailure,
} from './textToPath';
