/** The most decimal places {@link decimalPlaces} answers: what `toFixed` and `Intl` take in every engine. */
export const MAX_DECIMAL_PLACES = 20;

/**
 * The decimal places `n` is written with, up to {@link MAX_DECIMAL_PLACES}: `0.25` has two, `2.5` one, and
 * exponent form counts too, `1.5e-7` eight. A whole number, `1e21` included, has none, and so does a value
 * that is not finite.
 */
export function decimalPlaces(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const text = String(n);
  const e = text.indexOf('e');
  const mantissa = e < 0 ? text : text.slice(0, e);
  const dot = mantissa.indexOf('.');
  const places = (dot < 0 ? 0 : mantissa.length - dot - 1) - (e < 0 ? 0 : Number(text.slice(e + 1)));
  return Math.min(MAX_DECIMAL_PLACES, Math.max(0, places));
}
