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
  fontString,
} from './textStyle';
export type { TextStyle, TextPaint, ResolvedTextStyle } from './textStyle';

export { resolveRuns } from './runs/resolveRuns';
export type { ResolvedRun } from './runs/resolveRuns';

export { layoutRuns } from './layout/layoutRuns';
export {
  cachedLayoutRuns,
  LAYOUT_CACHE_VARIANT_LIMIT,
  LAYOUT_CACHE_STRUCTURAL_LIMIT,
} from './layout/layoutCache';
export type {
  LayoutRunsOpts,
  LaidOutRuns,
  LaidOutGroup,
  LaidOutQuad,
  LaidOutOutlineGlyph,
  LaidOutDecoration,
  LaidOutLineBox,
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
  PositionedRun,
  LayoutLine,
  LayoutResult,
  TextRenderer,
} from './markdownText';
