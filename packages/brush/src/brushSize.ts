import type { ToolOptionsSpec, ToolOptionShare } from '@weasel-js/routing';

/** The shared key a brush size measured in screen pixels is kept under. A size measured otherwise, in world units,
 *  needs a key of its own: shared with this one, it would mean a different brush in each tool. */
export const BRUSH_SIZE_PX = 'brushSizePx';

const NO_SHARE: ToolOptionShare = Object.freeze({});
const shares = new Map<string, ToolOptionShare>();

/** The share that keeps a brush's size, the option its `ToolOptionsSpec.size` names, under `key`: handed to each brush
 *  tool's `share` hook option, it gives them all one size, held to each tool's own bounds. Empty for a tool that
 *  names no size. The same option and key always return the same frozen object, so it can be called in a render. */
export function shareBrushSize(options: Pick<ToolOptionsSpec, 'size'>, key: string = BRUSH_SIZE_PX): ToolOptionShare {
  const option = options.size?.option;
  if (option === undefined) return NO_SHARE;
  const id = JSON.stringify([option, key]);
  let share = shares.get(id);
  if (!share) shares.set(id, share = Object.freeze({ [option]: key }));
  return share;
}
