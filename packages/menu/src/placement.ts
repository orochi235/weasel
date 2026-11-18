/** A position in viewport pixels (CSS pixels, as `getBoundingClientRect` reports). */
export interface Point { x: number; y: number }
/** A width and height in pixels. */
export interface MenuSize { width: number; height: number }
/** A rectangle in viewport pixels: top-left corner plus width and height. */
export interface MenuRect { x: number; y: number; width: number; height: number }

/** Start at `at`, else end at `flipAt` (default `at`), else slide inside `[lo, lo + span]`. */
function flipOrShift(at: number, len: number, lo: number, span: number, flipAt = at): number {
  const hi = lo + span;
  if (at + len <= hi) return Math.max(lo, at);
  if (flipAt - len >= lo) return Math.max(lo, Math.min(flipAt - len, hi - len));
  return Math.max(lo, hi - len);
}

/** End at `at`, else start at `flipAt` (default `at`), else slide inside `[lo, lo + span]`: {@link flipOrShift} mirrored. */
function flipOrShiftBack(at: number, len: number, lo: number, span: number, flipAt = at): number {
  const hi = lo + span;
  if (at - len >= lo) return Math.min(at - len, hi - len);
  if (flipAt + len <= hi) return Math.max(lo, flipAt);
  return Math.max(lo, hi - len);
}

/** `at` held inside `[lo, lo + span]` for something `len` long, at `lo` when it is longer. */
function held(at: number, len: number, lo: number, span: number): number {
  return Math.max(lo, Math.min(at, lo + span - len));
}

/** The inline direction a menu is laid out in. Under `'rtl'` a menu opens to the left of where it hangs from. */
export type MenuDirection = 'ltr' | 'rtl';

/** Where a menu of `size` opened at `anchor` goes: down and right of the
 *  anchor (left under `'rtl'`), flipped on an axis that does not fit, shifted inside `bounds`
 *  when neither side does. */
export function placeMenu(size: MenuSize, anchor: Point, bounds: MenuRect, dir: MenuDirection = 'ltr'): Point {
  return {
    x: (dir === 'rtl' ? flipOrShiftBack : flipOrShift)(anchor.x, size.width, bounds.x, bounds.width),
    y: flipOrShift(anchor.y, size.height, bounds.y, bounds.height),
  };
}

/** Where a submenu goes: beside `row`, right first (left under `'rtl'`), the other side if that does not
 *  fit, top-aligned with the row and shifted up to stay inside `bounds`. */
export function placeSubmenu(size: MenuSize, row: MenuRect, bounds: MenuRect, dir: MenuDirection = 'ltr'): Point {
  return {
    x: dir === 'rtl'
      ? flipOrShiftBack(row.x, size.width, bounds.x, bounds.width, row.x + row.width)
      : flipOrShift(row.x + row.width, size.width, bounds.x, bounds.width, row.x),
    y: Math.max(bounds.y, Math.min(row.y, bounds.y + bounds.height - size.height)),
  };
}

/** The side of its button a menu opens on. */
export type MenuSide = 'top' | 'bottom' | 'left' | 'right';

/** Where a menu opened from the button at `under` goes: on `side` of it (default below), flipped to the opposite side
 *  when it does not fit there. Below or above, it is left-aligned and right-aligned to the button on an axis that does
 *  not fit (right-aligned first under `'rtl'`); beside, it is top-aligned and shifted up to stay inside `bounds`.
 *  Shifted inside `bounds` when neither side fits. */
export function placeMenuUnder(size: MenuSize, under: MenuRect, bounds: MenuRect, side: MenuSide = 'bottom', dir: MenuDirection = 'ltr'): Point {
  if (side === 'left' || side === 'right') {
    const x = side === 'left' && under.x - size.width >= bounds.x
      ? held(under.x - size.width, size.width, bounds.x, bounds.width)
      : flipOrShift(under.x + under.width, size.width, bounds.x, bounds.width, under.x);
    return { x, y: Math.max(bounds.y, Math.min(under.y, bounds.y + bounds.height - size.height)) };
  }
  const y = side === 'top' && under.y - size.height >= bounds.y
    ? held(under.y - size.height, size.height, bounds.y, bounds.height)
    : flipOrShift(under.y + under.height, size.height, bounds.y, bounds.height, under.y);
  const x = dir === 'rtl'
    ? flipOrShiftBack(under.x + under.width, size.width, bounds.x, bounds.width, under.x)
    : flipOrShift(under.x, size.width, bounds.x, bounds.width, under.x + under.width);
  return { x, y };
}
