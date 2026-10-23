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

/** The side of its button a menu opens on. */
export type MenuSide = 'top' | 'bottom' | 'left' | 'right';

/** Where a menu opened from the button at `under` goes: on `side` of it (default below), flipped to the opposite side
 *  when it does not fit there. Below or above, it is left-aligned and right-aligned to the button on an axis that does
 *  not fit; beside, it is top-aligned and shifted up to stay inside `bounds`. Shifted inside `bounds` when neither
 *  side fits. */
export function placeMenuUnder(size: Size, under: Rect, bounds: Rect, side: MenuSide = 'bottom'): Point {
  if (side === 'left' || side === 'right') {
    const x = side === 'left' && under.x - size.w >= bounds.x
      ? under.x - size.w
      : flipOrShift(under.x + under.w, size.w, bounds.x, bounds.w, under.x);
    return { x, y: Math.max(bounds.y, Math.min(under.y, bounds.y + bounds.h - size.h)) };
  }
  const y = side === 'top' && under.y - size.h >= bounds.y
    ? under.y - size.h
    : flipOrShift(under.y + under.h, size.h, bounds.y, bounds.h, under.y);
  return { x: flipOrShift(under.x, size.w, bounds.x, bounds.w, under.x + under.w), y };
}
