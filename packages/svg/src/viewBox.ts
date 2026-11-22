import type { Rect } from '@weasel-js/geom';
import { readNumbers } from './transform';

/**
 * Parse an SVG `viewBox="x y width height"` attribute. Returns undefined
 * on null/empty/malformed input. Numbers may be separated by whitespace
 * and/or commas, or abut where the second cannot continue the first (SVG spec).
 * A negative width or height invalidates the attribute, as SVG says.
 */
export function parseViewBoxAttr(
  raw: string | null,
): Rect | undefined {
  if (raw == null) return undefined;
  const nums = readNumbers(raw);
  if (nums?.length !== 4 || nums[2] < 0 || nums[3] < 0) return undefined;
  return { x: nums[0], y: nums[1], width: nums[2], height: nums[3] };
}
