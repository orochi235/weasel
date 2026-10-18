import { decimal, qty, type Display } from '@weasel-js/quantity';

const FULL_PRECISION = decimal({ maxPlaces: 20, grouping: false });

/** A number row's value as a renderer with no field of its own prints it: in `display`, by default every decimal
 *  it has, then its unit. A dash for none. */
export function menuNumberText(value: number | undefined, suffix?: string, display: Display = FULL_PRECISION): string {
  return value === undefined ? '—' : `${qty(value, display).text}${suffix ?? ''}`;
}
