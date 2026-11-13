/**
 * How a text pose lays out — the one decision every consumer of a text node
 * reads: the painters (`kit:text`, `createTextLayer`), picking
 * (`textLineBoxes`), the caret (`caretIndexAt`), fitting (`fitTextPose`) and
 * the DOM edit overlay.
 *
 * The pose width is always the box `align` resolves within. It is the wrap
 * width only when the style declares `wrap`; otherwise a line runs as long as
 * its text, whichever of them is asking.
 */
import type { LayoutRunsOptions } from './layoutOpts';
import type { LaidOutRuns } from './layoutRuns';
import { cachedLayoutRuns } from './layoutCache';
import { resolveTextStyle, type ResolvedTextStyle } from '../textStyle';
import { resolveRuns, type ResolvedRun } from '../runs/resolveRuns';
import { toRuns } from '../runs';
import { verticalAlignOffset } from '../measure/verticalAlign';
import type { TextPose } from '../pose';
import { scaleRuns, scaleStyle, shrinkScale } from './textFit';

/** What {@link layoutTextPose} hands `cachedLayoutRuns`. */
export interface TextPoseLayoutInput {
  style: ResolvedTextStyle;
  runs: ResolvedRun[];
  opts: LayoutRunsOptions & { justify: boolean };
  /** What `pose.fit` scaled every size in `style` and `runs` by: 1 unless it shrank them. */
  fitScale: number;
}

/**
 * The resolved runs and layout options for `pose`. A text draw command built
 * from these lays out, in the renderer, into exactly the lines
 * {@link layoutTextPose} reports.
 *
 * `scale` is the view scale a `{ px }` `fontSize` or `letterSpacing` resolves
 * against. Everything past this point is world units, so a caller that
 * measures, hit-tests or paints one pose has to pass the same scale to each
 * or they disagree.
 *
 * `pose.fit: 'shrink'` is resolved here, so every reader sets the text at the
 * fitted size: `style` and `runs` come back already scaled by `fitScale`.
 */
export function textPoseLayoutInput(pose: TextPose, scale = 1): TextPoseLayoutInput {
  const style = resolveTextStyle(pose.style, { fill: pose.fill, stroke: pose.stroke }, scale);
  // Empty runs are not a styling, so they fall back to the plain string
  // rather than lay out nothing.
  const source = pose.runs && pose.runs.length > 0 ? pose.runs : pose.text;
  const runs = resolveRuns(toRuns(source), style, scale);
  const opts = {
    maxWidth: style.wrap ? pose.width : Infinity,
    alignWidth: pose.width,
    lineHeight: style.lineHeight,
    align: style.align,
    direction: style.direction,
    tabSize: style.tabSize,
    justify: style.align === 'justify',
  };
  const k = pose.fit === 'shrink' ? shrinkScale(runs, opts, pose.width, pose.height) : 1;
  if (k === 1) return { style, runs, opts, fitScale: 1 };
  return { style: scaleStyle(style, k), runs: scaleRuns(runs, k), opts, fitScale: k };
}

/** What `pose.fit` scales its text by, as {@link textPoseLayoutInput} resolves it: 1 unless it shrinks. */
export function textFitScale(pose: TextPose, scale = 1): number {
  return pose.fit === 'shrink' ? textPoseLayoutInput(pose, scale).fitScale : 1;
}

/** A text pose laid out. */
export interface TextPoseLayout {
  /** Origin-relative, shared with the layout cache — treat as immutable. */
  laid: LaidOutRuns;
  /** World position of the layout's origin: `pose.x`, and `pose.y` shifted by
   *  `verticalAlign` within the pose height. */
  x: number;
  y: number;
}

/** The lines `pose` lays out into, and where they sit in world space. */
export function layoutTextPose(pose: TextPose, scale = 1): TextPoseLayout {
  const { runs, opts } = textPoseLayoutInput(pose, scale);
  const laid = cachedLayoutRuns(runs, opts);
  return {
    laid,
    x: pose.x,
    y: pose.y + verticalAlignOffset(pose.verticalAlign, pose.height, laid.bounds.height),
  };
}
