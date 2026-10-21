import { decimal, endless, qty, type Display } from '@weasel-js/quantity';
import type { MenuNumberEntry } from './entries';

const FULL_PRECISION = decimal({ maxPlaces: 20, grouping: false });

/** How a number row's value shows: its `display`, by default every decimal it has, with its word for infinity. */
export function menuNumberDisplay(e: Pick<MenuNumberEntry, 'display' | 'infinity'>): Display {
  const display = e.display ?? FULL_PRECISION;
  return e.infinity === undefined ? display : endless(display, e.infinity);
}

/** A number row's value as a renderer with no field of its own prints it: in {@link menuNumberDisplay}, then its
 *  unit, which an infinity goes without. A dash for none. */
export function menuNumberText(value: number | undefined, e: Pick<MenuNumberEntry, 'display' | 'infinity' | 'suffix'> = {}): string {
  if (value === undefined) return '—';
  const text = qty(value, menuNumberDisplay(e)).text;
  return Number.isFinite(value) ? `${text}${e.suffix ?? ''}` : text;
}
