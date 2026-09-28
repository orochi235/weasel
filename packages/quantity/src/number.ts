import { entryScale, type UnitEntry } from './units';

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

/** One unsigned number in the text `readNumber` sees: digits, with an optional `.` fraction. */
const TERM_NUMBER = String.raw`\d+(?:\.\d+)?|\.\d+`;

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
export function parseNumber(text: string, units?: Readonly<UnitTable>, locale = 'en-US'): number {
  const n = readNumber(delocalized(text, locale), units);
  return Number.isNaN(n) && locale !== 'en-US' ? readNumber(delocalized(text, 'en-US'), units) : n;
}

/** `parseNumber` once every number in the text is in `en-US` form with no grouping. */
function readNumber(text: string, units?: Readonly<UnitTable>): number {
  if (units) {
    units = withSpellings(units);
    const trimmed = text.trim();
    const name = unitSuffixOf(trimmed, units);
    if (name !== undefined) {
      const terms = compoundTermsOf(trimmed, units);
      if (terms !== undefined && terms.length > 1) return compoundValue(terms, trimmed, units);
      const { factor, offset } = entryScale(units[name]!);
      return scaled(readNumber(trimmed.slice(0, -name.length)), factor) + offset;
    }
  }
  let t = text.trim().replace(MINUS_SIGN, '-');
  const exponent = EXPONENTS[t.slice(-1).toLowerCase()];
  if (exponent !== undefined) t = t.slice(0, -1).trimEnd();
  if (!/\d/.test(t)) return Number.NaN;
  // Scaled through the exponent rather than by multiplying: 1.1 * 1000 is 1100.0000000000002.
  return Number(exponent === undefined ? t : `${t}e${exponent}`);
}

interface NumberShape {
  /** A run of digits and separators in a text, a candidate number. */
  run: RegExp;
  /** Whether a run is a whole number in the locale's form. */
  whole: RegExp;
  group: RegExp;
  decimal: string;
  /** The locale's own digits, where they are not `0`–`9`, each mapped to its Latin one. */
  digits?: { pattern: RegExp; latin: ReadonlyMap<string, string> };
}

const shapes = new Map<string, NumberShape>();

/** How `locale` writes a number, read off `Intl`: its separators and group sizes (`12,34,567` in `en-IN`). */
function shapeOf(locale: string): NumberShape {
  const known = shapes.get(locale);
  if (known) return known;
  const parts = new Intl.NumberFormat(locale).formatToParts(123_456_789.5);
  const sizes = parts.filter((p) => p.type === 'integer').map((p) => p.value.length);
  const primary = sizes.at(-1)!;
  const secondary = sizes.length > 2 ? sizes.at(-2)! : primary;
  const groupChar = parts.find((p) => p.type === 'group')?.value ?? ',';
  const decimal = parts.find((p) => p.type === 'decimal')?.value ?? '.';
  // CLDR versions disagree between a straight and a curly apostrophe, as keyboards do.
  const g = /\s/.test(groupChar) ? String.raw`\s` : /['’]/.test(groupChar) ? `'’` : escapeClass(groupChar);
  const own = [...new Intl.NumberFormat(locale, { useGrouping: false }).format(9_876_543_210)].reverse();
  const digits = own.join('') === '0123456789'
    ? undefined
    : { pattern: new RegExp(`[${own.join('')}]`, 'gu'), latin: new Map(own.map((c, i) => [c, String(i)])) };
  const d = escapeClass(decimal);
  const integer = String.raw`\d{1,${secondary}}(?:[${g}]\d{${secondary}})*[${g}]\d{${primary}}|\d*`;
  const shape: NumberShape = {
    run: new RegExp(String.raw`(?:\d|[${d}]\d)(?:[\d${g}${d}]*\d)?[${d}]?`, 'g'),
    whole: new RegExp(String.raw`^(?:${integer})(?:[${d}]\d*)?$`),
    group: new RegExp(`[${g}]`, 'g'),
    decimal,
    digits,
  };
  shapes.set(locale, shape);
  return shape;
}

export const escapeClass = (c: string) => c.replace(/[\\\]^-]/g, '\\$&');

/** `text` with each number in `locale`'s form rewritten ungrouped with a `.` decimal, and the rest untouched. */
function delocalized(text: string, locale: string): string {
  const shape = shapeOf(locale);
  return latinDigits(text, locale).replace(shape.run, (run) =>
    shape.whole.test(run) ? run.replace(shape.group, '').replace(shape.decimal, '.') : run,
  );
}

/**
 * `text` with `locale`'s own digits written `0`–`9` and the bidi marks `Intl`
 * puts around a sign (`؜-` in `ar-EG`) dropped.
 */
export function latinDigits(text: string, locale: string): string {
  const { digits } = shapeOf(locale);
  const t = text.replace(BIDI_MARKS, '');
  return digits ? t.replace(digits.pattern, (c) => digits.latin.get(c)!) : t;
}

const BIDI_MARKS = /[\u061c\u200e\u200f]/g;

/** The mark `locale` writes before a fraction: `.` in `en-US`, `,` in `de-DE`. */
export const decimalOf = (locale: string): string => shapeOf(locale).decimal;

/** Suffixes a person may type, each mapped to its conversion into the shown unit. */
export type UnitTable = Record<string, UnitEntry>;

/**
 * Units that are written more than one way. A table accepting any spelling
 * accepts them all: `"` wherever `in` is, `ft` wherever `'` is. The primes and
 * curly quotes are there because a keyboard substitutes them for the marks.
 */
const SPELLINGS: readonly (readonly string[])[] = [
  ['in', '"', '″', '”'],
  ['ft', "'", '′', '’'],
];

function withSpellings(units: Readonly<UnitTable>): Readonly<UnitTable> {
  let out: UnitTable | undefined;
  for (const group of SPELLINGS) {
    const known = group.find((n) => units[n] !== undefined);
    if (known === undefined) continue;
    for (const n of group) {
      if (units[n] !== undefined) continue;
      out ??= { ...units };
      out[n] = units[known]!;
    }
  }
  return out ?? units;
}

/** Divided by the reciprocal below 1: 12 * 0.1 is 1.2000000000000002, 12 / 10 is 1.2. */
function scaled(n: number, factor: number): number {
  return factor < 1 ? n / (1 / factor) : n * factor;
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
    const m = new RegExp(`(?:${TERM_NUMBER})\\s*$`).exec(before);
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
  const digits = text.match(new RegExp(TERM_NUMBER, 'g'));
  if (!digits || digits.length !== names.length) return Number.NaN;
  const sign = /^\s*[-\u2212]/.test(text) ? -1 : 1;
  let total = 0;
  for (const [i, name] of names.entries()) {
    const { factor, offset } = entryScale(units[name]!);
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
