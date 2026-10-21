/** A position in viewport pixels (CSS pixels, as `getBoundingClientRect` reports). */
export interface Point { x: number; y: number }
/** A width and height in pixels. */
export interface Size { w: number; h: number }
/** A rectangle in viewport pixels: top-left corner plus width and height. */
export interface Rect { x: number; y: number; w: number; h: number }

/** Start at `at`, else end at `flipAt` (default `at`), else slide inside `[lo, lo + span]`. */
function flipOrShift(at: number, len: number, lo: number, span: number, flipAt = at): number {
  const hi = lo + span;
  if (at + len <= hi) return Math.max(lo, at);
  if (flipAt - len >= lo) return Math.max(lo, Math.min(flipAt - len, hi - len));
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
  return {
    x: flipOrShift(row.x + row.w, size.w, bounds.x, bounds.w, row.x),
    y: Math.max(bounds.y, Math.min(row.y, bounds.y + bounds.h - size.h)),
  };
}

/** Where a menu opened from the button at `under` goes: below it and
 *  left-aligned, flipped above it or right-aligned to it on an axis that does
 *  not fit, shifted inside `bounds` when neither side does. With `above` the
 *  top is tried first and the menu flips below when it does not fit there. */
export function placeMenuUnder(size: Size, under: Rect, bounds: Rect, above = false): Point {
  const y = above && under.y - size.h >= bounds.y
    ? under.y - size.h
    : flipOrShift(under.y + under.h, size.h, bounds.y, bounds.h, under.y);
  return { x: flipOrShift(under.x, size.w, bounds.x, bounds.w, under.x + under.w), y };
}
