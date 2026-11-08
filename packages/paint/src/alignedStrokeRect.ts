import type { StrokeAlign } from './paint';

/**
 * Whether {@link alignedStrokeRect} draws `align` on `rect`: always, but for an
 * inner stroke at least as wide as the rect's narrower side, which covers the
 * whole rect where the shifted rect would turn inside out and draw outside it.
 */
export function alignedStrokeRectHolds(
  rect: { width: number; height: number },
  align: StrokeAlign,
  width = 1,
): boolean {
  return align !== 'inner' || width < Math.min(Math.abs(rect.width), Math.abs(rect.height));
}

/**
 * Inflate (positive) or deflate (negative) a rect to honor `align` when
 * stroking it: the returned rect's center-aligned stroke coincides with the
 * requested inner/outer-aligned stroke of the original. `width` is the
 * stroke width (defaults to 1 to match canvas).
 */
export function alignedStrokeRect(
  rect: { x: number; y: number; width: number; height: number },
  align: StrokeAlign,
  width = 1,
): { x: number; y: number; width: number; height: number } {
  if (align === 'center') return rect;
  // For 'inner', shift inward by width/2 so the stroke's outer edge coincides
  // with the geometric edge. For 'outer', shift outward.
  const sign = align === 'inner' ? -1 : 1;
  const d = (sign * width) / 2;
  // A negative extent runs its axis backward, so the shift does too.
  const dx = rect.width < 0 ? -d : d;
  const dy = rect.height < 0 ? -d : d;
  return {
    x: rect.x - dx,
    y: rect.y - dy,
    width: rect.width + 2 * dx,
    height: rect.height + 2 * dy,
  };
}
