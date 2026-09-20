/**
 * Build a `TextDrawCommand`. `textCommandFromPose` is the command for a text
 * node — what `kit:text` and `createTextLayer` both emit. `textCommand` takes
 * a plain string and wraps it in one run; `textCommandFromRuns` takes the
 * styled runs directly, for text that has no pose. All three
 * resolve through `resolveTextStyle` + `resolveRuns`, so every emitter of a
 * text command derives `align` and per-run resolution the same way — a
 * caller that assembles the command by hand is one field away from a
 * silently different result.
 *
 * `paint` is the node's `data.fill` / `data.stroke`. A caller with no node —
 * a HUD widget, a debug overlay — states its color on the run instead.
 *
 * `scale` is the view scale a `{ px }` `fontSize` or `letterSpacing` resolves
 * against — for a world-space layer, the mean of `view.scale.x` and
 * `view.scale.y`. It has to be applied here and not at draw time, because a
 * screen-pixel size moves the glyph advances and so the wrap points.
 */

import type { DrawCommand, TextDrawCommand } from '../../renderer';
import type { TextPaint, TextPose, TextStyle } from '@weasel-js/text';
import { resolveAlign, resolveTextStyle, textPoseLayoutInput } from '@weasel-js/text';
import { resolveRuns } from '@weasel-js/text';
import type { StyledRun } from '@weasel-js/text';
import type { TextVerticalAlign } from '@weasel-js/text';

export function textCommandFromRuns(
  x: number,
  y: number,
  runs: readonly StyledRun[],
  style?: TextStyle,
  maxWidth?: number,
  height?: number,
  verticalAlign?: TextVerticalAlign,
  paint?: TextPaint,
  width?: number,
  scale = 1,
): DrawCommand {
  const resolved = resolveTextStyle(style, paint, scale);
  return {
    kind: 'text',
    x,
    y,
    runs: resolveRuns(runs, resolved, scale),
    align: resolveAlign(resolved.align, resolved.direction),
    maxWidth,
    style: style ?? {},
    height,
    verticalAlign,
    width,
  };
}

/** Build a draw command for a single unstyled string. Text is laid out with
 *  the registered font's metrics, wrapped at `maxWidth`, aligned across
 *  `width` (default `maxWidth`) and within `height` when `verticalAlign` is
 *  given. */
export function textCommand(
  x: number,
  y: number,
  text: string,
  style?: TextStyle,
  maxWidth?: number,
  height?: number,
  verticalAlign?: TextVerticalAlign,
  paint?: TextPaint,
  width?: number,
  scale = 1,
): DrawCommand {
  return textCommandFromRuns(
    x, y, [{ text }], style, maxWidth, height, verticalAlign, paint, width, scale,
  );
}

/**
 * The draw command for a text pose. Its wrap width, alignment box and runs
 * come from `textPoseLayoutInput`, so the renderer lays it out into exactly
 * the lines `layoutTextPose` reports for the same pose.
 */
export function textCommandFromPose(pose: TextPose, scale = 1): TextDrawCommand {
  const { runs, opts } = textPoseLayoutInput(pose, scale);
  return {
    kind: 'text',
    x: pose.x,
    y: pose.y,
    runs,
    align: opts.align,
    maxWidth: opts.maxWidth,
    width: opts.alignWidth,
    style: pose.style ?? {},
    height: pose.height,
    verticalAlign: pose.verticalAlign,
  };
}
