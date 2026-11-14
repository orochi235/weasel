/** What a fit scope remembers of its element's room, as the element's own width. */
export interface FitRoom {
  /** The width when the last step was taken: growing past it retries the full forms. */
  steppedAt: number | null;
  /** The width once marked spent, the room that marking gave it included. */
  spentAt: number | null;
  /** Whether `--wzl-fit-natural` holds the width at the current labels' full forms. */
  measured: boolean;
}

const NATURAL = '--wzl-fit-natural';
const ROOM = 'data-fit-room';
const SPENT = 'data-fit-spent';

const px = (v: string): number => Number.parseFloat(v) || 0;

/**
 * `el`'s inline size at the content it holds now, in the terms its own `box-sizing` sizes it in, never short of it:
 * a floor a fraction of a pixel short lets the full forms widen the box from inside the observer that restored them.
 */
function naturalWidth(el: HTMLElement): number {
  const style = getComputedStyle(el);
  const border = px(style.borderLeftWidth) + px(style.borderRightWidth);
  // scrollWidth is rounded to a whole pixel; the box's own width is exact once nothing overflows it.
  const outer = el.scrollWidth > el.clientWidth ? el.scrollWidth + 1 + border : el.getBoundingClientRect().width;
  if (style.boxSizing === 'border-box') return outer;
  return outer - border - px(style.paddingLeft) - px(style.paddingRight);
}

/** Marks `el` a fit room while it holds labels, and publishes its width at the full forms while it shows them. */
export function prepareRoom(el: HTMLElement, room: FitRoom, depth: number, atFullForms: boolean): void {
  if (depth < 1) {
    el.removeAttribute(ROOM);
    el.removeAttribute(SPENT);
    el.style.removeProperty(NATURAL);
    room.spentAt = null;
    room.measured = false;
    return;
  }
  el.setAttribute(ROOM, '');
  if (room.measured || !atFullForms) return;
  // Measured without the floor the last labels left, which a shorter set would otherwise fill out to.
  el.style.removeProperty(NATURAL);
  el.style.setProperty(NATURAL, `${naturalWidth(el)}px`);
  room.measured = true;
}

/** Clears a spent mark `el` has grown out of, then marks it spent where it overflows at its labels' last forms. */
export function settleSpent(el: HTMLElement, room: FitRoom, atLastForms: boolean): void {
  if (room.spentAt !== null && el.clientWidth > room.spentAt + 0.5) {
    room.spentAt = null;
    el.removeAttribute(SPENT);
  }
  if (room.spentAt !== null || !atLastForms || el.scrollWidth <= el.clientWidth) return;
  el.setAttribute(SPENT, '');
  room.spentAt = el.clientWidth;
}
