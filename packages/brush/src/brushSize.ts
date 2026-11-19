import type { ToolOptionsSpec, ToolOptionShare } from '@weasel-js/routing';

/** The shared key a brush size measured in screen pixels is kept under. A size measured otherwise, in world units,
 *  needs a key of its own: shared with this one, it would mean a different brush in each tool. */
export const BRUSH_SIZE_PX = 'brushSizePx';

interface SizeLeaf {
  kind?: string;
  measure?: string;
  unit?: { scale?: number; offset?: number; suffix?: string; toDisplay?: unknown };
}

/** Whether `leaf` says its size is in something other than screen pixels. A leaf naming neither a unit nor a
 *  measure says nothing, and passes. */
function measuredOtherwise(leaf: SizeLeaf | undefined): boolean {
  if (leaf?.kind !== 'number') return false;
  if (leaf.measure !== undefined) return true;
  const unit = leaf.unit;
  if (!unit) return false;
  return typeof unit.toDisplay === 'function' || unit.suffix !== 'px' || unit.scale !== 1 || (unit.offset ?? 0) !== 0;
}

/** The share that keeps a brush's size, the option its `ToolOptionsSpec.size` names, under `key`: handed to each brush
 *  tool's `share` hook option, it gives them all one size, held to each tool's own bounds. Empty for a tool that
 *  names no size. Throws for an empty `key`, and for a size whose leaf is in another unit under
 *  {@link BRUSH_SIZE_PX}: such a size passes a key of its own. */
export function shareBrushSize(
  options: Pick<ToolOptionsSpec, 'size'> & Partial<Pick<ToolOptionsSpec, 'prefs'>>, key: string = BRUSH_SIZE_PX,
): ToolOptionShare {
  const option = options.size?.option;
  if (option === undefined) return {};
  if (key === '') throw new Error('shareBrushSize: the key is empty, which would leave the size each tool’s own');
  const children = options.prefs?.children;
  const leaf = children && Object.hasOwn(children, option) ? (children[option] as SizeLeaf) : undefined;
  if (key === BRUSH_SIZE_PX && measuredOtherwise(leaf)) {
    throw new Error(`shareBrushSize: "${option}" is not in screen pixels, so it cannot share "${BRUSH_SIZE_PX}"; pass a key of its own`);
  }
  return { [option]: key };
}
