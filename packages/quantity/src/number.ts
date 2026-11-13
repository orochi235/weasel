import { entryScale, type UnitEntry } from './units';
import { unitSpellings } from './catalog';

/**
 * The real MINUS SIGN (U+2212), which display formatting uses instead of the
 * ASCII HYPHEN-MINUS (U+002D) that `toLocaleString` and template literals
 * produce. It is the same visual width as `+`, so columns of signed numbers
 * align.
 */
export const MINUS_SIGN = '−';

/**
 * Formats a number for display, substituting {@link MINUS_SIGN} for the ASCII
 * hyphen `toLocaleString` emits. Non-finite values stringify as-is.
 */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  const formatted = Number.isFinite(value)
    ? unsignedZero(value, (n) => n.toLocaleString(undefined, options))
    : String(value);
  return signed(formatted);
}

/** `-` swapped for {@link MINUS_SIGN} at the front of already-formatted text,
 *  past the bidi marks some locales write before a sign (`؜-` in `ar-EG`). */
export function signed(text: string): string {
  return text.replace(LEADING_HYPHEN, `$1${MINUS_SIGN}`);
}

const LEADING_HYPHEN = /^([\u061c\u200e\u200f]*)-/;

/** Whether `text` starts with a minus sign, either spelling, past any bidi marks before it. */
export const LEADING_MINUS = /^[\u061c\u200e\u200f]*[-\u2212]/;

/**
 * `value` through `format`, with a negative that rounds to zero shown as the
 * zero it reads as: −0.0004 at two places is `0`, not `−0`.
 */
export function unsignedZero(value: number, format: (n: number) => string): string {
  const shown = format(value);
  return value <= 0 && shown === format(-0) ? format(0) : shown;
}

/**
 * Parses a string that may carry {@link MINUS_SIGN} in place of the ASCII
 * hyphen, as `Number` does otherwise: empty text is 0, and a group separator
 * is NaN. That makes it the inverse of {@link formatNumber} only for values it
 * writes without grouping; {@link parseNumber} reads the grouped form back.
 */
export function parseSignedNumber(text: string): number {
  return Number(hyphenated(text));
}

/** `text` with every {@link MINUS_SIGN} an ASCII hyphen: an exponent's sign as well as the number's. */
const hyphenated = (text: string): string => text.replaceAll(MINUS_SIGN, '-');

/** `n` to the nearest whole number, a half away from zero, as `Intl` rounds one: `Math.round(-2.5)` is −2. */
export function roundWhole(n: number): number {
  const r = Math.sign(n) * Math.round(Math.abs(n));
  return r === 0 ? 0 : r;
}

/** One unsigned number in the text `readNumber` sees: digits, with an optional `.` fraction. */
const TERM_NUMBER = String.raw`\d+(?:\.\d+)?|\.\d+`;

const DECIMAL_NUMBER = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i;

/** Powers of ten a typed magnitude suffix stands for. */
const EXPONENTS: Record<string, number> = { k: 3, m: 6, b: 9, t: 12 };

/**
 * Formats a number the way a `compact` readout shows it: below 1,000 at
 * `decimals` places, from 1,000 up at three significant figures with a magnitude
 * suffix (`40.0K`, `294K`, `2.00M`), so the readout holds one width whatever the
 * value. The number is written in `locale` (`40,0K` in `de-DE`) and the suffix
 * stays the `K`/`M`/`B`/`T` that {@link parseNumber} reads in any locale, where
 * `Intl`'s own compact words (`2 Mio.`) would not read back.
 */
export function formatCompact(value: number, decimals = 0, locale = 'en-US'): string {
  if (!Number.isFinite(value)) return formatNumber(value);
  if (belowCompact(value, decimals)) {
    const plain = { useGrouping: false, minimumFractionDigits: decimals, maximumFractionDigits: decimals };
    return signed(unsignedZero(value, (n) => n.toLocaleString(locale, plain)));
  }
  const parts = COMPACT_EN.formatToParts(Math.abs(value));
  const of = (type: string) => parts.filter((p) => p.type === type).map((p) => p.value).join('');
  const places = of('fraction').length;
  const mantissa = Number(`${of('integer').replaceAll(',', '')}.${of('fraction') || '0'}`)
    .toLocaleString(locale, { minimumFractionDigits: places, maximumFractionDigits: places });
  return `${value < 0 ? MINUS_SIGN : ''}${mantissa}${of('compact')}`;
}

const COMPACT_EN = new Intl.NumberFormat('en-US', { notation: 'compact', minimumSignificantDigits: 3, maximumSignificantDigits: 3 });

/** Whether `value` shows below a thousand at `decimals` places, where a compact
 *  readout writes it plain. Asked of the value as shown: 999.6 reads `1000`. */
export function belowCompact(value: number, decimals: number): boolean {
  return Number(Math.abs(value).toFixed(decimals)) < 1000;
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
  let t = hyphenated(text.trim());
  const exponent = EXPONENTS[t.slice(-1).toLowerCase()];
  if (exponent !== undefined) t = t.slice(0, -1).trimEnd();
  // `Number` alone also reads `0x10`, `0b11`, and `1e400`, none of which is a typed amount.
  if (!DECIMAL_NUMBER.test(t)) return Number.NaN;
  // Scaled through the exponent rather than by multiplying: 1.1 * 1000 is 1100.0000000000002.
  const n = Number(exponent === undefined ? t : `${t}e${exponent}`);
  return Number.isFinite(n) ? n : Number.NaN;
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

/**
 * The number inside text that wraps one in symbols, such as a currency sign
 * or code on either side: its sign, its digits in `locale`'s form or
 * `en-US`'s, and a magnitude suffix typed against them, ready for
 * {@link parseNumber}. Empty when the text holds no number.
 */
export function numberWithin(text: string, locale: string): string {
  const t = latinDigits(text, locale);
  const m = new RegExp(shapeOf(locale).run.source).exec(t);
  if (!m) return '';
  const around = t.slice(0, m.index) + t.slice(m.index + m[0].length);
  const suffix = /^[kmbt](?!\p{L})/iu.exec(t.slice(m.index + m[0].length))?.[0] ?? '';
  return `${/[-\u2212]/.test(around) ? '-' : ''}${m[0]}${suffix}`;
}

/** The mark `locale` writes before a fraction: `.` in `en-US`, `,` in `de-DE`. */
export const decimalOf = (locale: string): string => shapeOf(locale).decimal;

/** Suffixes a person may type, each mapped to its conversion into the shown unit. */
export type UnitTable = Record<string, UnitEntry>;

/**
 * `units` with every other spelling the unit catalog knows for each of its
 * units: `"` wherever `in` is, `ft` wherever `'` is.
 */
export function withSpellings(units: Readonly<UnitTable>): Readonly<UnitTable> {
  let out: UnitTable | undefined;
  for (const [known, entry] of Object.entries(units)) {
    for (const n of unitSpellings(known)) {
      if (units[n] !== undefined || out?.[n] !== undefined) continue;
      out ??= { ...units };
      out[n] = entry;
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
