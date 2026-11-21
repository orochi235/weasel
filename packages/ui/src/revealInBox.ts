import { scrolledPlaceOf } from '@weasel-js/routing';

/** Scroll `box` the least that shows all of `row` along the block axis. Only `box` scrolls: `scrollIntoView` would
 *  also scroll every scrollable ancestor, the window included. */
export function revealInBox(row: HTMLElement, box: HTMLElement): void {
  const top = scrolledPlaceOf(row, box).y;
  if (top < box.scrollTop) box.scrollTop = top;
  else if (top + row.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = top + row.offsetHeight - box.clientHeight;
}
