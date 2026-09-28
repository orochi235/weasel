import type { Display } from './quantity';
import type { Unit } from './units';
import { MINUS_SIGN } from './number';

/**
 * One run of a formatted value, named for what it is: `number`, `unit`,
 * `currency`, `numerator`, `literal`. The HTML serialization marks each
 * non-literal run with `data-part`, which is the whole styling surface.
 */
export interface Part {
  type: string;
  value: string;
}

/** What formatting and parsing need beyond the value and its display. */
export interface FormatContext {
  /** BCP 47 locale. Default `en-US`. */
  locale: string;
  /** The unit the value is measured in, from its tag. */
  unit?: Unit;
}

/**
 * The behavior behind one `Display.kind`. `format` is required; `speak`
 * defaults to the formatted text, `parse` to `parseNumber`, and `mathml` to
 * nothing, which means the kind has no MathML form.
 */
export interface DisplayKind<D extends Display = Display> {
  kind: D['kind'];
  format(value: number, display: D, ctx: FormatContext): Part[];
  speak?(value: number, display: D, ctx: FormatContext): string;
  parse?(text: string, display: D, ctx: FormatContext): number;
  mathml?(value: number, display: D, ctx: FormatContext): string | undefined;
}

/** Parts joined into plain text. */
export function textOf(parts: readonly Part[]): string {
  return parts.map((p) => p.value).join('');
}

/** A number run from `Intl`, with the real minus sign. */
export function numberPart(value: number, locale: string, options?: Intl.NumberFormatOptions): Part {
  return { type: 'number', value: signed(value.toLocaleString(locale, options)) };
}

/** `-` swapped for {@link MINUS_SIGN} at the front of already-formatted text. */
export function signed(text: string): string {
  return text.replace(/^-/, MINUS_SIGN);
}

/** A leading minus sign read aloud: `−3` is spoken `minus 3`, which a screen
 *  reader otherwise renders as a dash or drops. */
export function spokenSign(text: string): string {
  return text.replace(/^[-−]/, 'minus ');
}

/** `singular` or `plural` for `value`, by the locale's plural rules. */
export function plural(value: number, locale: string, singular: string, pluralForm: string): string {
  return new Intl.PluralRules(locale).select(value) === 'one' ? singular : pluralForm;
}

/**
 * `Intl.NumberFormat`'s parts, with the digit runs — sign, integer, group,
 * decimal, fraction — merged into one `number` part, so a styling layer sees
 * the number as one thing and its unit or symbol as another.
 */
export function intlParts(value: number, locale: string, options: Intl.NumberFormatOptions): Part[] {
  const out: Part[] = [];
  for (const p of new Intl.NumberFormat(locale, options).formatToParts(value)) {
    const type = DIGIT_RUNS.has(p.type) ? 'number' : p.type;
    const v = p.type === 'minusSign' ? MINUS_SIGN : p.value;
    const last = out[out.length - 1];
    if (type === 'number' && last?.type === 'number') last.value += v;
    else out.push({ type, value: v });
  }
  return out;
}

const DIGIT_RUNS = new Set(['minusSign', 'plusSign', 'integer', 'group', 'decimal', 'fraction']);
