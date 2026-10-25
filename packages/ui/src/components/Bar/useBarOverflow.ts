import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

/** Marks a bar's child as one of its items, by key, for {@link useBarOverflow} to measure. */
export const BAR_ITEM = 'data-bar-item';
/** Marks the bar's child that opens what did not fit. */
export const BAR_MORE = 'data-bar-more';
/** Marks the bar's name at the start of its line, which takes room from its items. */
export const BAR_LEAD = 'data-bar-lead';

// A bar's room is a whole number of pixels and its cells are not.
const SLACK = 0.5;

/**
 * How many of a bar's items, from the first, fit along its line beside the
 * button that opens the rest: all of them where the line holds every one.
 * Measured before the first paint, and again when the bar or an item on it
 * changes size. An item off the line keeps the size it last had on it.
 *
 * `natural` is the length the bar takes with every item on its line, frame
 * included: what it asks its host for, so that a host sized to its content
 * offers it that much and it opens the menu only once squeezed below it.
 * Undefined until every item has been measured.
 *
 * `least` is the shortest the bar can be and still draw something past its
 * lead: its only item, or the button that opens the rest. A host squeezing
 * several bars into one line leaves each this much. Undefined until the first
 * item has been measured.
 */
export function useBarOverflow(
  on: boolean,
  keys: readonly string[],
  vertical: boolean,
): { bar: RefObject<HTMLDivElement | null>; kept: number; natural: number | undefined; least: number | undefined } {
  const bar = useRef<HTMLDivElement | null>(null);
  const sizes = useRef(new Map<string, number>());
  const more = useRef(0);
  const [kept, setKept] = useState(Number.POSITIVE_INFINITY);
  const [natural, setNatural] = useState<number | undefined>(undefined);
  const [least, setLeast] = useState<number | undefined>(undefined);
  const signature = keys.join('\n');

  useLayoutEffect(() => {
    const el = bar.current;
    if (!on || el === null) return;
    const along = (node: Element): number => {
      const box = node.getBoundingClientRect();
      return vertical ? box.height : box.width;
    };
    const measure = (): void => {
      for (const child of el.querySelectorAll(`:scope > [${BAR_ITEM}]`)) sizes.current.set(child.getAttribute(BAR_ITEM)!, along(child));
      const button = el.querySelector(`:scope > [${BAR_MORE}]`);
      if (button !== null) more.current = along(button);
      const room = roomOf(el, vertical);
      const lead = el.querySelector(`:scope > [${BAR_LEAD}]`);
      if (lead !== null) room.size -= along(lead) + room.gap;
      const all = signature === '' ? [] : signature.split('\n');
      setKept(fitting(all, sizes.current, more.current, room));
      const line = lineLength(all, sizes.current, room.gap);
      const lead0 = lead === null ? 0 : along(lead) + (all.length > 0 ? room.gap : 0);
      const frame = frameOf(el, vertical);
      setNatural(line === undefined ? undefined : Math.ceil(line + lead0 + frame));
      const first = all.length === 0 ? 0 : sizes.current.get(all[0]!);
      // Until the button has been drawn, the first item stands in for it.
      const end = all.length > 1 && more.current > 0 ? more.current : first;
      setLeast(end === undefined ? undefined : Math.ceil(end + lead0 + frame));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    for (const child of el.children) observer.observe(child);
    return () => observer.disconnect();
  }, [on, signature, kept, vertical]);

  return { bar, kept: on ? Math.min(kept, keys.length) : keys.length, natural: on ? natural : undefined, least: on ? least : undefined };
}

/** The length of `keys` laid end to end `gap` apart, or undefined while one has never been measured. */
function lineLength(keys: readonly string[], sizes: ReadonlyMap<string, number>, gap: number): number | undefined {
  if (keys.some((key) => !sizes.has(key))) return undefined;
  return keys.reduce((sum, key, i) => sum + sizes.get(key)! + (i > 0 ? gap : 0), 0);
}

/** A bar's padding and border along its line. */
function frameOf(el: HTMLElement, vertical: boolean): number {
  const style = getComputedStyle(el);
  const px = (value: string): number => Number.parseFloat(value) || 0;
  return vertical
    ? px(style.paddingTop) + px(style.paddingBottom) + px(style.borderTopWidth) + px(style.borderBottomWidth)
    : px(style.paddingLeft) + px(style.paddingRight) + px(style.borderLeftWidth) + px(style.borderRightWidth);
}

/** The length of a bar's line inside its padding, and the gap between two items on it. */
export interface BarRoom {
  size: number;
  gap: number;
}

function roomOf(el: HTMLElement, vertical: boolean): BarRoom {
  const style = getComputedStyle(el);
  const px = (value: string): number => Number.parseFloat(value) || 0;
  return vertical
    ? { size: el.clientHeight - px(style.paddingTop) - px(style.paddingBottom), gap: px(style.rowGap) }
    : { size: el.clientWidth - px(style.paddingLeft) - px(style.paddingRight), gap: px(style.columnGap) };
}

/** The count of `keys` that fit in `room`: infinite for all of them, and while one has never been measured. */
export function fitting(keys: readonly string[], sizes: ReadonlyMap<string, number>, more: number, room: BarRoom): number {
  if (keys.some((key) => !sizes.has(key))) return Number.POSITIVE_INFINITY;
  const all = keys.reduce((sum, key, i) => sum + sizes.get(key)! + (i > 0 ? room.gap : 0), 0);
  if (all <= room.size + SLACK) return Number.POSITIVE_INFINITY;
  let used = more;
  let count = 0;
  for (const key of keys) {
    used += sizes.get(key)! + room.gap;
    if (used > room.size + SLACK) break;
    count++;
  }
  return count;
}
