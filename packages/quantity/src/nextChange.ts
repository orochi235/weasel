import { textOf } from './kind';
import { contextFor, displayKindOf, partsOf, type PresentOptions } from './present';
import { amount, displayOf, retag, type Display, type Quantity } from './quantity';

/** Decades the search widens through before it calls a value's text fixed. */
const DECADES = 40;
/** How close, as a fraction of the answer, the search pins a change. A wake this late is never seen. */
const TOLERANCE = 1e-4;

/**
 * How long, in the time unit `rate` is measured per, until the text of a value
 * moving from `value` at `rate` changes, read off `text` alone: it widens a step
 * by tens until the text differs, then halves the gap. The answer lands at or
 * just past the change. Infinity when `rate` is 0, either is not finite, or the
 * text holds across forty decades.
 */
export function searchedChange(text: (value: number) => string, value: number, rate: number): number {
  if (rate === 0 || !Number.isFinite(value) || !Number.isFinite(rate)) return Infinity;
  const dir = Math.sign(rate);
  const from = text(value);
  const same = (step: number) => text(value + dir * step) === from;
  let lo = 0;
  let hi = Math.max(Math.abs(value) * 1e-12, 1e-12);
  for (let i = 0; same(hi); i++) {
    if (i === DECADES) return Infinity;
    lo = hi;
    hi *= 10;
  }
  while (hi - lo > hi * TOLERANCE) {
    const mid = (lo + hi) / 2;
    if (same(mid)) lo = mid;
    else hi = mid;
  }
  return hi / Math.abs(rate);
}

/**
 * How long until `q`'s text changes while it moves at `rate`, in the unit of
 * time `rate` is per: `nextChangeFor(12.2, 1, duration())` is 0.3, when `0:12`
 * turns `0:13`. What a live readout sleeps for between redraws. A negative rate
 * counts down; a rate of 0 never changes. The kind answers where it has a
 * `nextChange`, else its text is searched.
 */
export function nextChangeFor(q: Quantity, rate: number, fallback?: Display, options?: PresentOptions): number {
  const display = displayOf(q, fallback);
  const value = amount(q);
  if (rate === 0 || !Number.isFinite(value) || !Number.isFinite(rate)) return Infinity;
  const kind = displayKindOf(display);
  if (kind.nextChange && display !== undefined) return kind.nextChange(value, rate, display, contextFor(q, options));
  return searchedChange((v) => textOf(partsOf(retag(q, v), fallback, options)), value, rate);
}
