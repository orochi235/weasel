/** A position in screen pixels. */
export interface Point { x: number; y: number }
/** A width and height in pixels. */
export interface Size { w: number; h: number }
/** A rectangle in screen pixels: top-left corner plus width and height. */
export interface Rect { x: number; y: number; w: number; h: number }

/** Start at `at`, else end there (flip), else slide inside `[lo, lo + span]`. */
function flipOrShift(at: number, len: number, lo: number, span: number): number {
  const hi = lo + span;
  if (at + len <= hi) return Math.max(lo, at);
  if (at - len >= lo) return at - len;
  return Math.max(lo, hi - len);
}

/** Where a menu of `size` opened at `anchor` goes: down and right of the
 *  anchor, flipped on an axis that does not fit, shifted inside `bounds`
 *  when neither side does. */
export function placeMenu(size: Size, anchor: Point, bounds: Rect): Point {
  return {
    x: flipOrShift(anchor.x, size.w, bounds.x, bounds.w),
    y: flipOrShift(anchor.y, size.h, bounds.y, bounds.h),
  };
}

/** Where a submenu goes: beside `row`, right first, left if that does not
 *  fit, top-aligned with the row and shifted up to stay inside `bounds`. */
export function placeSubmenu(size: Size, row: Rect, bounds: Rect): Point {
  const right = row.x + row.w;
  const hiX = bounds.x + bounds.w;
  const x = right + size.w <= hiX
    ? right
    : row.x - size.w >= bounds.x ? row.x - size.w : Math.max(bounds.x, hiX - size.w);
  const y = Math.max(bounds.y, Math.min(row.y, bounds.y + bounds.h - size.h));
  return { x, y };
}
