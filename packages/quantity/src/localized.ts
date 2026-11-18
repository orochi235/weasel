import { fieldLocale } from './fieldLocale';
import { formatCompactIn, parseNumberIn, signed, unsignedZero, type UnitTable } from './number';

/**
 * The locale numbers are shown and read in when none is asked for: the browser's language as
 * {@link fieldLocale} settles it, and `en-US` where there is none (on a server). Text for a person
 * defaults to this; a number written to be saved or read by a program passes `en-US` itself.
 */
export function defaultLocale(): string {
  return fieldLocale(globalThis.navigator?.language);
}

/**
 * Formats a number for display, substituting {@link MINUS_SIGN} for the ASCII
 * hyphen `toLocaleString` emits. Non-finite values stringify as-is.
 */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  const formatted = Number.isFinite(value)
    ? unsignedZero(value, (n) => n.toLocaleString(defaultLocale(), options))
    : String(value);
  return signed(formatted);
}

/**
 * Formats a number the way a `compact` readout shows it: below 1,000 at
 * `places` places, from 1,000 up at three significant figures with a magnitude
 * suffix (`40.0K`, `294K`, `2.00M`), so the readout holds one width whatever the
 * value. The number is written in `locale` (`40,0K` in `de-DE`) and the suffix
 * stays the `K`/`M`/`B`/`T` that {@link parseNumber} reads in any locale, where
 * `Intl`'s own compact words (`2 Mio.`) would not read back.
 */
export function formatCompact(value: number, places = 0, locale = defaultLocale()): string {
  return formatCompactIn(value, places, locale);
}

/**
 * Reads a typed number: anything {@link parseSignedNumber} reads, plus the
 * locale's group and decimal separators (`40,000` and `2.5` in `en-US`,
 * `40.000` and `2,5` in `de-DE`) and a `k`/`m`/`b`/`t` suffix in either case
 * (`2.5m` is 2,500,000). Empty text is NaN rather than zero.
 *
 * Text the locale's form does not read is tried as `en-US`, so `1.5` is still
 * one and a half in `de-DE`; where both read, the locale wins. A locale that
 * groups with a space accepts any space there, since a keyboard types a plain
 * one where `Intl` writes a no-break space.
 *
 * Given `units` — a suffix mapped to the factor it scales by — a trailing unit
 * name is read first: the longest match wins, exact case before any case, and
 * a unit beats a magnitude suffix, so with `m` accepted `2m` is `2 * units.m`.
 */
export function parseNumber(text: string, units?: Readonly<UnitTable>, locale = defaultLocale()): number {
  return parseNumberIn(text, units, locale);
}
