import { DEFAULT_TEXT_STYLE, cachedLayoutRuns, verticalAlignOffset, type LaidOutRuns } from '@weasel-js/text';
import type { TextDrawCommand } from './DrawCommand';

/**
 * `cmd` laid out as the renderer draws it, and where its layout's top-left
 * lands: its position plus the `verticalAlign` shift. The layout is the cached
 * one, so drawing and bounding a command share it.
 */
export function laidOutText(cmd: TextDrawCommand): { laid: LaidOutRuns; dx: number; dy: number } {
  // Read field by field rather than through `resolveTextStyle`, which builds a
  // whole resolved style per command per frame and needs four of its fields.
  const style = cmd.style;
  const laid = cachedLayoutRuns(cmd.runs, {
    maxWidth: cmd.maxWidth ?? Infinity,
    alignWidth: cmd.width,
    lineHeight: style.lineHeight ?? DEFAULT_TEXT_STYLE.lineHeight,
    align: cmd.align ?? style.align ?? DEFAULT_TEXT_STYLE.align,
    direction: cmd.direction ?? style.direction ?? DEFAULT_TEXT_STYLE.direction,
    tabSize: style.tabSize ?? DEFAULT_TEXT_STYLE.tabSize,
    justify: cmd.justify,
  });
  // Applied at upload time, not baked in: a cached layout that absorbed either
  // offset would gain another one every frame and slide off the page.
  return { laid, dx: cmd.x, dy: cmd.y + verticalAlignOffset(cmd.verticalAlign, cmd.height, laid.bounds.height) };
}
