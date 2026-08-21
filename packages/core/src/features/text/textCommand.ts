/**
 * Build a `TextDrawCommand`. `textCommand` takes a plain string and wraps it
 * in one run; `textCommandFromRuns` takes the styled runs directly. Both
 * resolve through `resolveTextStyle` + `resolveRuns`, so every emitter of a
 * text command derives `align` and per-run resolution the same way — a
 * caller that assembles the command by hand is one field away from a
 * silently different result.
 */

import type { DrawCommand } from '../../renderer';
import type { TextStyle } from './textStyle';
import { resolveTextStyle } from './textStyle';
import { resolveRuns } from './runs/resolveRuns';
import type { StyledRun } from './runs';
import type { TextVerticalAlign } from './verticalAlign';

export function textCommandFromRuns(
  x: number,
  y: number,
  runs: readonly StyledRun[],
  style?: TextStyle,
  maxWidth?: number,
  height?: number,
  verticalAlign?: TextVerticalAlign,
): DrawCommand {
  const resolved = resolveTextStyle(style);
  return {
    kind: 'text',
    x,
    y,
    runs: resolveRuns(runs, resolved),
    align: resolved.align,
    maxWidth,
    style: style ?? {},
    height,
    verticalAlign,
  };
}

/** Build a draw command for a single unstyled string. Text is laid out with
 *  the registered font's metrics, wrapped at `maxWidth` and aligned within
 *  `height` when both are given. */
export function textCommand(
  x: number,
  y: number,
  text: string,
  style?: TextStyle,
  maxWidth?: number,
  height?: number,
  verticalAlign?: TextVerticalAlign,
): DrawCommand {
  return textCommandFromRuns(x, y, [{ text }], style, maxWidth, height, verticalAlign);
}
