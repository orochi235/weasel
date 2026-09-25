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
 * `decimals` places, from 1,000 up at three significant figures with a magnitude
 * suffix (`40.0K`, `294K`, `2.00M`), so the readout holds one width whatever the
 * value. Always `en-US`, so {@link parseNumber} reads it back.
 */
export function formatCompact(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return formatNumber(value);
  const options: Intl.NumberFormatOptions =
    Math.abs(value) < 1000
      ? { useGrouping: false, minimumFractionDigits: decimals, maximumFractionDigits: decimals }
      : { notation: 'compact', minimumSignificantDigits: 3, maximumSignificantDigits: 3 };
  return value.toLocaleString('en-US', options).replace(/^-/, MINUS_SIGN);
}

/**
 * Reads a typed number: anything {@link parseSignedNumber} reads, plus
 * thousands commas in the `40,000` shape and a `k`/`m`/`b`/`t` suffix in either
 * case (`2.5m` is 2,500,000). Empty text is NaN rather than zero.
 *
 * Given `units` — a suffix mapped to the factor it scales by — a trailing unit
 * name is read first: the longest match wins, exact case before any case, and
 * a unit beats a magnitude suffix, so with `m` accepted `2m` is `2 * units.m`.
 */
export function parseNumber(text: string, units?: Readonly<UnitTable>): number {
  if (units) {
    const trimmed = text.trim();
    const name = unitSuffixOf(trimmed, units);
    if (name !== undefined) {
      const terms = compoundTermsOf(trimmed, units);
      if (terms !== undefined && terms.length > 1) return compoundValue(terms, trimmed, units);
      const { factor, offset } = scaleOf(units[name]!);
      return scaled(parseNumber(trimmed.slice(0, -name.length)), factor) + offset;
    }
  }
  let t = text.trim().replace(MINUS_SIGN, '-');
  const exponent = EXPONENTS[t.slice(-1).toLowerCase()];
  if (exponent !== undefined) t = t.slice(0, -1).trimEnd();
  if (/^[-+]?\d{1,3}(,\d{3})+(\.\d*)?$/.test(t)) t = t.replace(/,/g, '');
  if (!/\d/.test(t)) return Number.NaN;
  // Scaled through the exponent rather than by multiplying: 1.1 * 1000 is 1100.0000000000002.
  return Number(exponent === undefined ? t : `${t}e${exponent}`);
}

/** One unit's conversion into the shown unit: a bare factor, or a scale that
 *  also moves zero. Structurally the kit's `UnitEntry`, kept local so this
 *  formatting helper stays free of the scene vocabulary. */
export type UnitTableEntry = number | { factor: number; offset?: number };
/** Suffixes a person may type, each mapped to its conversion. */
export type UnitTable = Record<string, UnitTableEntry>;

/** Divided by the reciprocal below 1: 12 * 0.1 is 1.2000000000000002, 12 / 10 is 1.2. */
function scaled(n: number, factor: number): number {
  return factor < 1 ? n / (1 / factor) : n * factor;
}

/** A unit table entry's scale, with the bare-factor shorthand widened. */
function scaleOf(entry: UnitTableEntry): { factor: number; offset: number } {
  return typeof entry === 'number'
    ? { factor: entry, offset: 0 }
    : { factor: entry.factor, offset: entry.offset ?? 0 };
}

/**
 * The unit names in `text`, in reading order, when every one of them closes a
 * `<number><unit>` term — which is what tells `5ft 3in` from a malformed
 * `5ft 3`. Undefined when the text is not a run of whole terms.
 */
function compoundTermsOf(text: string, units: Readonly<UnitTable>): string[] | undefined {
  const names: string[] = [];
  let rest = text.trimEnd();
  while (rest !== '') {
    const name = unitSuffixOf(rest, units);
    if (name === undefined) return undefined;
    names.push(name);
    const before = rest.slice(0, -name.length);
    const m = /(\d+(?:\.\d+)?|\.\d+)\s*$/.exec(before);
    if (!m) return undefined;
    rest = before.slice(0, m.index).trimEnd();
    // A sign leads the whole value, so it ends the walk rather than a term.
    if (rest === '-' || rest === '+' || rest === MINUS_SIGN) rest = '';
  }
  return names.length === 0 ? undefined : names.reverse();
}

/**
 * `5ft 3in` as one number in the shown unit. Every term scales and they sum;
 * a leading sign carries across all of them, so `-5ft 3in` is −63in and not
 * −57. Offsets have no meaning in a sum — 1K + 2degC is not a temperature —
 * so a term carrying one makes the whole value unreadable.
 */
function compoundValue(names: string[], text: string, units: Readonly<UnitTable>): number {
  const digits = text.match(/\d+(?:\.\d+)?|\.\d+/g);
  if (!digits || digits.length !== names.length) return Number.NaN;
  const sign = /^\s*[-\u2212]/.test(text) ? -1 : 1;
  let total = 0;
  for (const [i, name] of names.entries()) {
    const { factor, offset } = scaleOf(units[name]!);
    if (offset !== 0) return Number.NaN;
    total += scaled(Number(digits[i]), factor);
  }
  return sign * total;
}

/** The longest unit name `text` ends with — exact case first, then any case. */
function unitSuffixOf(text: string, units: Readonly<UnitTable>): string | undefined {
  const names = Object.keys(units).filter((n) => n !== '').sort((a, b) => b.length - a.length);
  const lower = text.toLowerCase();
  return names.find((n) => text.endsWith(n)) ?? names.find((n) => lower.endsWith(n.toLowerCase()));
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
