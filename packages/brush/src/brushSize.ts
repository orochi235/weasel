import type { ToolOptions, ToolOptionShare } from '@weasel-js/routing';

/** The shared key a brush size measured in screen pixels is kept under. A size measured otherwise, in world units,
 *  needs a key of its own: shared with this one, it would mean a different brush in each tool. */
export const BRUSH_SIZE_PX = 'brushSizePx';

/** The share that keeps a brush's size, the option its `ToolOptions.size` names, under `key`: handed to each brush
 *  tool's `share` hook option, it gives them all one size, held to each tool's own bounds. Empty for a tool that
 *  names no size. */
export function shareBrushSize(options: Pick<ToolOptions, 'size'>, key: string = BRUSH_SIZE_PX): ToolOptionShare {
  const option = options.size?.option;
  return option === undefined ? {} : { [option]: key };
}
