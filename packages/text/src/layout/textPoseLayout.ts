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
import type { LaidOutRuns, LayoutRunsOpts } from './layoutRuns';
import { cachedLayoutRuns } from './layoutCache';
import { resolveAlign, resolveTextStyle, type ResolvedTextStyle } from '../textStyle';
import { resolveRuns, type ResolvedRun } from '../runs/resolveRuns';
import { toRuns } from '../runs';
import { verticalAlignOffset } from '../measure/verticalAlign';
import type { TextPose } from '../pose';

/** What {@link layoutTextPose} hands `cachedLayoutRuns`. */
export interface TextPoseLayoutInput {
  style: ResolvedTextStyle;
  runs: ResolvedRun[];
  opts: LayoutRunsOpts & { align: 'left' | 'center' | 'right' };
}

/**
 * The resolved runs and layout options for `pose`. A text draw command built
 * from these lays out, in the renderer, into exactly the lines
 * {@link layoutTextPose} reports.
 */
export function textPoseLayoutInput(pose: TextPose): TextPoseLayoutInput {
  const style = resolveTextStyle(pose.style, { fill: pose.fill, stroke: pose.stroke });
  // Empty runs are not a styling, so they fall back to the plain string
  // rather than lay out nothing.
  const source = pose.runs && pose.runs.length > 0 ? pose.runs : pose.text;
  return {
    style,
    runs: resolveRuns(toRuns(source), style),
    opts: {
      maxWidth: style.wrap ? pose.width : Infinity,
      alignWidth: pose.width,
      lineHeight: style.lineHeight,
      align: resolveAlign(style.align, style.direction),
    },
  };
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
export function layoutTextPose(pose: TextPose): TextPoseLayout {
  const { runs, opts } = textPoseLayoutInput(pose);
  const laid = cachedLayoutRuns(runs, opts);
  return {
    laid,
    x: pose.x,
    y: pose.y + verticalAlignOffset(pose.verticalAlign, pose.height, laid.bounds.height),
  };
}
