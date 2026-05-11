/**
 * Build a `TextDrawCommand` for a single plain-text string. The string is
 * wrapped in a single resolved run, taking style defaults via
 * `resolveTextStyle` + `resolveRuns`. For inline-styled (multi-run) text,
 * build the command directly using `resolveRuns(runs, resolveTextStyle(style))`.
 */

import type { DrawCommand } from '../../renderer';
import type { TextStyle } from './textStyle';
import { resolveTextStyle } from './textStyle';
import { resolveRuns } from './runs/resolveRuns';

export function textCommand(
  x: number,
  y: number,
  text: string,
  style?: TextStyle,
  maxWidth?: number,
): DrawCommand {
  const resolved = resolveTextStyle(style);
  const runs = resolveRuns([{ text }], resolved);
  return {
    kind: 'text',
    x,
    y,
    runs,
    align: resolved.align,
    maxWidth,
    style: style ?? {},
  };
}
