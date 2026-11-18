import { decimal, defaultLocale, withInfinity, fieldLocale, qty, withUnit, type Display } from '@weasel-js/quantity';
import type { MenuNumberEntry } from './entries';

const FULL_PRECISION = decimal({ maxPlaces: 20, grouping: false });

/** How a number row's value shows: its `display`, by default every decimal it has, with its word for infinity. */
export function menuNumberDisplay(e: Pick<MenuNumberEntry, 'display' | 'infinity'>): Display {
  const display = e.display ?? FULL_PRECISION;
  return e.infinity === undefined ? display : withInfinity(display, e.infinity);
}

/** A number row's value as a renderer with no field of its own prints it: in {@link menuNumberDisplay}, written in
 *  `locale` as `fieldLocale` settles it, as a field would show it, then its unit, which an infinity goes without. A
 *  dash for none. */
export function menuNumberText(
  value: number | undefined, e: Pick<MenuNumberEntry, 'display' | 'infinity' | 'suffix'> = {}, locale = defaultLocale(),
): string {
  if (value === undefined) return '—';
  const text = qty(value, menuNumberDisplay(e), { locale: fieldLocale(locale) }).text;
  return Number.isFinite(value) ? withUnit(text, e.suffix) : text;
}
