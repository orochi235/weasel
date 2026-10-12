/**
 * Tab stops, CSS `tab-size`'s way: a tab runs from where it starts on its line
 * to the next multiple of the stop interval, so its advance is known only once
 * the line it lands on is.
 */

/** CSS `tab-size`'s initial value, in spaces. */
export const DEFAULT_TAB_SIZE = 8;

/** A tab's stop interval and the least it may advance, both in world units. */
export interface TabStop {
  stop: number;
  /** Half a space: CSS skips a stop nearer than that to the following one. */
  min: number;
}

/** How far a tab starting `x` into its line advances. */
export function tabAdvance(x: number, stop: number, min: number): number {
  if (!(stop > 0)) return 0;
  const toNext = (Math.floor(x / stop) + 1) * stop - x;
  return toNext < min ? toNext + stop : toNext;
}

/**
 * Width of entries `[start, end)` set on a line opening at `start`, with each
 * tab among them (`tabs`, ascending entry indices) run out to its stop.
 * `flatWidth` is the same measure with every tab taken as zero-width. `piece`
 * hears each stretch between tabs and the x it starts at.
 */
export function widthWithTabs(
  start: number,
  end: number,
  tabs: readonly number[],
  stopOf: (index: number) => TabStop,
  flatWidth: (start: number, end: number) => number,
  piece?: (start: number, end: number, x: number) => void,
): number {
  let x = 0;
  let from = start;
  const lay = (to: number): void => {
    if (to <= from) return;
    piece?.(from, to, x);
    x += flatWidth(from, to);
  };
  for (const t of tabs) {
    if (t < start) continue;
    if (t >= end) break;
    lay(t);
    const { stop, min } = stopOf(t);
    x += tabAdvance(x, stop, min);
    from = t + 1;
  }
  lay(end);
  return x;
}
