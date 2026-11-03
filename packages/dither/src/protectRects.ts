import type { OutputGrid, Rect } from '@weasel-js/geom';

/**
 * Rects to protect, in dot space (one unit per dot, from the grid's origin),
 * the pixel space an export rendered at the grid's resolution has.
 * `protectedRect` answers an item's rect in document units, which may be
 * larger than the item (a barcode's quiet zone), or false or null to leave
 * it to the dither.
 */
export function protectRects<T>(
  items: Iterable<T>,
  protectedRect: (item: T) => Rect | false | null,
  grid: OutputGrid,
): Rect[] {
  const out: Rect[] = [];
  for (const item of items) {
    const r = protectedRect(item);
    if (!r) continue;
    out.push({
      x: (r.x - grid.origin.x) / grid.pitch,
      y: (r.y - grid.origin.y) / grid.pitch,
      width: r.width / grid.pitch,
      height: r.height / grid.pitch,
    });
  }
  return out;
}
