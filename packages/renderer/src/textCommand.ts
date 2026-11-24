/**
 * Build a `TextDrawCommand`. `textCommandFromPose` is the command for a text
 * node; `textCommand` takes a plain string and wraps it in one run;
 * `textCommandFromRuns` takes the styled runs directly, for text that has no
 * pose. All three resolve through `resolveTextStyle` + `resolveRuns` — a
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

import type { DrawCommand, TextDrawCommand } from './index';
import type { TextPaint, TextPose, TextStyle } from '@weasel-js/text';
import { DEFAULT_TEXT_STYLE, resolveTextStyleInto, textPoseLayoutInput } from '@weasel-js/text';
import { layoutRuns, resolveRuns, resolveRunsInto } from '@weasel-js/text';
import type { StyledRun } from '@weasel-js/text';
import type { TextVerticalAlign, ResolvedRun, ResolvedTextStyle } from '@weasel-js/text';
import { isSolidPaint, type Paint } from '@weasel-js/paint';
import type { Rect } from '@weasel-js/geom';
import { commandFill, commandStroke } from './patterns/commandPaint';
import { noteTextRefill } from './textBounds';
import { layoutOptsOf } from './textLayout';

/** The style each command resolves into: read while its runs resolve, and
 *  kept by nothing. */
const resolvedStyle: ResolvedTextStyle = { ...DEFAULT_TEXT_STYLE };

/** Build a draw command from styled runs, for text with no pose. `style`
 *  supplies the defaults each run inherits; the rest match `textCommand`. */
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
  const resolved = resolveTextStyleInto(resolvedStyle, style, paint, scale);
  return resolveRunPaints({
    kind: 'text',
    x,
    y,
    runs: resolveRuns(runs, resolved, scale),
    align: resolved.align,
    direction: resolved.direction,
    justify: resolved.align === 'justify',
    maxWidth,
    style: style ?? {},
    height,
    verticalAlign,
    width,
  });
}

/**
 * {@link textCommandFromRuns} into `cmd`, an earlier result of it that the
 * caller owns, refilled in place along with its runs and returned. For text
 * rewritten every frame: call `evictRunsForRefill(cmd.runs)` first, and anything still
 * holding `cmd` sees the new text.
 */
export function textCommandFromRunsInto(
  cmd: TextDrawCommand,
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
): TextDrawCommand {
  const resolved = resolveTextStyleInto(resolvedStyle, style, paint, scale);
  cmd.x = x;
  cmd.y = y;
  cmd.runs = resolveRunsInto(cmd.runs, runs, resolved, scale);
  cmd.align = resolved.align;
  cmd.direction = resolved.direction;
  cmd.justify = resolved.align === 'justify';
  cmd.maxWidth = maxWidth;
  cmd.style = style ?? {};
  cmd.height = height;
  cmd.verticalAlign = verticalAlign;
  cmd.width = width;
  noteTextRefill(cmd);
  return resolveRunPaints(cmd);
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
 *
 * Each run's paints are resolved against the pose box the way every other
 * node's are — a `'bounds'` paint mapped onto it, a pattern spec swapped for
 * its texture — since the renderer can do neither.
 */
export function textCommandFromPose(pose: TextPose, scale = 1): TextDrawCommand {
  const { runs, opts } = textPoseLayoutInput(pose, scale);
  return {
    kind: 'text',
    x: pose.x,
    y: pose.y,
    runs: paintsResolved(runs, pose),
    align: opts.align,
    direction: opts.direction,
    justify: opts.justify,
    maxWidth: opts.maxWidth,
    width: opts.alignWidth,
    style: pose.style ?? {},
    height: pose.height,
    verticalAlign: pose.verticalAlign,
  };
}

/** `cmd` with each run's paints resolved against the text's own box: its position, and its `width` (else a finite
 *  `maxWidth`) and `height`, measured from its layout where it has none. */
function resolveRunPaints(cmd: TextDrawCommand): TextDrawCommand {
  const runs = cmd.runs;
  if (runs.every((r) => isSolid(r.fill?.paint) && isSolid(r.stroke?.paint))) return cmd;
  const box = runs.some((r) => isBounds(r.fill?.paint) || isBounds(r.stroke?.paint))
    ? textBoxOf(cmd)
    : { x: cmd.x, y: cmd.y, width: 0, height: 0 };
  paintsResolved(runs, box);
  return cmd;
}

/** `runs`, written in place, with each paint resolved onto `box` by `commandFill` and `commandStroke`. */
function paintsResolved(runs: ResolvedRun[], box: Rect): ResolvedRun[] {
  for (const r of runs) {
    if (r.fill && !isSolid(r.fill.paint)) r.fill = commandFill(r.fill, box);
    if (r.stroke && !isSolid(r.stroke.paint)) r.stroke = commandStroke(r.stroke, box) ?? undefined;
  }
  return runs;
}

function textBoxOf(cmd: TextDrawCommand): Rect {
  let width = cmd.width ?? (Number.isFinite(cmd.maxWidth) ? cmd.maxWidth : undefined);
  let height = cmd.height;
  let x = cmd.x;
  if (width === undefined || height === undefined) {
    // Uncached: the runs are written to after this, which a cached layout of them must not see.
    const { lines, bounds } = layoutRuns(cmd.runs, layoutOptsOf(cmd));
    if (width === undefined && lines.length > 0) x += Math.min(...lines.map((l) => l.x0));
    width ??= bounds.width;
    height ??= bounds.height;
  }
  return { x, y: cmd.y, width, height };
}

function isBounds(paint: Paint | null | undefined): boolean {
  return paint != null && (paint as { units?: string }).units === 'bounds';
}

function isSolid(paint: Paint | null | undefined): boolean {
  return paint == null || isSolidPaint(paint);
}
