import {
  DEFAULT_TEXT_STYLE, cachedLayoutRuns, verticalAlignOffset, type LaidOutRuns, type LayoutRunsOpts,
} from '@weasel-js/text';
import type { TextDrawCommand } from './DrawCommand';

/** Where a command's layout lands. */
export interface LaidOutText { laid: LaidOutRuns; dx: number; dy: number }

// Both refilled on every call, which every text command makes every frame:
// `cachedLayoutRuns` copies what it keeps out of the options, and both callers
// read the result before anything calls again.
const opts: LayoutRunsOpts = {
  maxWidth: 0, alignWidth: undefined, lineHeight: 0, align: 'left', direction: 'auto', tabSize: 0, justify: undefined,
};
const out = { laid: null as unknown as LaidOutRuns, dx: 0, dy: 0 };

/**
 * `cmd` laid out as the renderer draws it, and where its layout's top-left
 * lands: its position plus the `verticalAlign` shift. The layout is the cached
 * one, so drawing and bounding a command share it.
 *
 * The result is overwritten by the next call: read it, don't keep it. Nor is
 * the layout kept: it is asked for as `'read'`, so the cache may give its
 * arrays to another layout once nothing files it.
 */
export function laidOutText(cmd: TextDrawCommand): Readonly<LaidOutText> {
  // Read field by field rather than through `resolveTextStyle`, which builds a
  // whole resolved style per command per frame and needs four of its fields.
  const style = cmd.style;
  opts.maxWidth = cmd.maxWidth ?? Infinity;
  opts.alignWidth = cmd.width;
  opts.lineHeight = style.lineHeight ?? DEFAULT_TEXT_STYLE.lineHeight;
  opts.align = cmd.align ?? style.align ?? DEFAULT_TEXT_STYLE.align;
  opts.direction = cmd.direction ?? style.direction ?? DEFAULT_TEXT_STYLE.direction;
  opts.tabSize = style.tabSize ?? DEFAULT_TEXT_STYLE.tabSize;
  opts.justify = cmd.justify;
  const laid = cachedLayoutRuns(cmd.runs, opts, 'read');
  // Applied at upload time, not baked in: a cached layout that absorbed either
  // offset would gain another one every frame and slide off the page.
  out.laid = laid;
  out.dx = cmd.x;
  out.dy = cmd.y + verticalAlignOffset(cmd.verticalAlign, cmd.height, laid.bounds.height);
  return out;
}
