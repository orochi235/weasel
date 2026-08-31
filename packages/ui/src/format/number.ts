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
