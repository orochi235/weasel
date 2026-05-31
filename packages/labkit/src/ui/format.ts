// Display formatting helpers shared across the UI.
//
// House style: render negative numbers with the typographic MINUS SIGN
// (U+2212, "−") instead of ASCII hyphen-minus ("-"). Editing surfaces should
// accept either glyph on input via `parseSignedNumber`.

const MINUS = '−';

/** Format a finite number for display, swapping the leading "-" to U+2212. */
export function formatNumber(n: number, fractionDigits?: number): string {
  if (!Number.isFinite(n)) return String(n);
  const s = fractionDigits == null ? String(n) : n.toFixed(fractionDigits);
  return s.startsWith('-') ? MINUS + s.slice(1) : s;
}

/** Parse a string that may use U+2212 or ASCII hyphen-minus for the negative sign. */
export function parseSignedNumber(s: string): number {
  return Number(s.replace(MINUS, '-'));
}
