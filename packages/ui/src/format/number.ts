/**
 * Display-formatter for numbers. Use this anywhere a number is shown to
 * a user. The whole point: negative values get prefixed with the real
 * MINUS SIGN (U+2212) instead of the ASCII HYPHEN-MINUS (U+002D) that
 * `toLocaleString` and template literals produce by default.
 *
 * U+2212 is the same visual width as `+` and reads as a sign rather
 * than a hyphen — columns of signed numbers align cleanly and the
 * glyph doesn't get confused with a bullet or list dash.
 */
export const MINUS_SIGN = '−';

/**
 * Formats a number for display, substituting {@link MINUS_SIGN} for the ASCII
 * hyphen `toLocaleString` emits. Non-finite values stringify as-is.
 */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  const formatted = Number.isFinite(value)
    ? value.toLocaleString(undefined, options)
    : String(value);
  return formatted.replace(/^-/, MINUS_SIGN);
}

/**
 * Parses a string that may carry {@link MINUS_SIGN} in place of the ASCII
 * hyphen. The inverse of {@link formatNumber} for any editing surface that
 * renders its value through it and reads the edited text back.
 */
export function parseSignedNumber(text: string): number {
  return Number(text.replace(MINUS_SIGN, '-'));
}

/** Powers of ten a typed magnitude suffix stands for. */
const EXPONENTS: Record<string, number> = { k: 3, m: 6, b: 9, t: 12 };

/**
 * Formats a number the way a `compact` readout shows it: below 1,000 at
 * `decimals` places, from 1,000 up at one decimal with a magnitude suffix
 * (`40.0K`, `2.0M`). Always `en-US`, so {@link parseNumber} reads it back.
 */
export function formatCompact(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return formatNumber(value);
  const options: Intl.NumberFormatOptions =
    Math.abs(value) < 1000
      ? { useGrouping: false, minimumFractionDigits: decimals, maximumFractionDigits: decimals }
      : { notation: 'compact', minimumFractionDigits: 1, maximumFractionDigits: 1 };
  return value.toLocaleString('en-US', options).replace(/^-/, MINUS_SIGN);
}

/**
 * Reads a typed number: anything {@link parseSignedNumber} reads, plus
 * thousands commas in the `40,000` shape and a `k`/`m`/`b`/`t` suffix in either
 * case (`2.5m` is 2,500,000). Empty text is NaN rather than zero.
 */
export function parseNumber(text: string): number {
  let t = text.trim().replace(MINUS_SIGN, '-');
  const exponent = EXPONENTS[t.slice(-1).toLowerCase()];
  if (exponent !== undefined) t = t.slice(0, -1).trimEnd();
  if (/^[-+]?\d{1,3}(,\d{3})+(\.\d*)?$/.test(t)) t = t.replace(/,/g, '');
  if (!/\d/.test(t)) return Number.NaN;
  // Scaled through the exponent rather than by multiplying: 1.1 * 1000 is 1100.0000000000002.
  return Number(exponent === undefined ? t : `${t}e${exponent}`);
}

/** {@link String} with the leading ASCII hyphen swapped for {@link MINUS_SIGN}.
 *  Locale-independent, unlike `toLocaleString`. */
function signedString(value: number): string {
  return String(value).replace(/^-/, MINUS_SIGN);
}

/**
 * Formats a zoom factor for display. Below 2x a percentage reads naturally;
 * past it the numbers get long and a multiplier is what people say out loud,
 * so 250% shows as `2.5x`. Past 100x a tenth is noise, so the decimal is
 * dropped and thousands are grouped: `1009.74` reads as `1,010x`.
 */
export function formatZoom(zoom: number): string {
  if (!Number.isFinite(zoom)) return String(zoom);
  if (zoom <= 2) return `${signedString(Math.round(zoom * 100))}%`;
  if (zoom >= 100) return `${Math.round(zoom).toLocaleString('en-US')}x`;
  return `${signedString(Math.round(zoom * 10) / 10)}x`;
}
