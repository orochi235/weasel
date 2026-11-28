import { createReflectable, type Reflection } from '@weasel-js/registry';
import { escapeMarkup as escape, spokenSign, textOf, type DisplayKind, type FormatContext, type Part } from './kind';
import { compactKind, decimalKind, integerKind } from './kinds/plain';
import { fractionKind, multiplierKind, percentKind, ratioKind, zoomKind } from './kinds/proportion';
import { bytesKind, currencyKind, durationKind, unitKind } from './kinds/measure';
import { ordinalKind, romanKind } from './kinds/numeral';
import { scientificKind } from './kinds/scientific';
import { instantKind, relativeKind } from './kinds/time';
import { infinityParts, infinityWord, readInfinity } from './infinity';
import { parseNumberIn } from './number';
import { defaultLocale } from './localized';
import { amount, displayOf, unitOf, type Display, type Quantity } from './quantity';
import { spokenTone, toneAt, type ValueTone } from './tones';
import type { Unit } from './units';

// Seeded from a static table rather than by each kind registering itself at import, so the package stays
// free of side effects and a bundler can drop what nobody imports.
const KINDS = createReflectable<DisplayKind<never>>({ name: 'display kinds' });
for (const k of [
  decimalKind, integerKind, compactKind, scientificKind,
  percentKind, fractionKind, ratioKind, multiplierKind, zoomKind,
  unitKind, currencyKind, durationKind, bytesKind, instantKind, relativeKind,
  romanKind, ordinalKind,
]) KINDS.push(k.kind, k as DisplayKind<never>, { source: 'kit', fallback: true });

/** Every display kind by its `kind` tag: the built-ins (source `'kit'`) and what {@link registerDisplayKind}
 *  added, a later registration shadowing an earlier one. */
export const displayKindRegistry: Reflection<DisplayKind<never>> = KINDS.reflection;

/**
 * Adds a display kind, or replaces a built-in one — the way to swap in a words
 * library for `fraction`'s spoken form (`{ ...fractionKind, speak }`). Returns
 * a function that removes it again, restoring whatever it shadowed.
 */
export function registerDisplayKind<D extends Display>(kind: DisplayKind<D>): () => void {
  return KINDS.push(kind.kind, kind as unknown as DisplayKind<never>);
}

/**
 * The kind behind `display`. An unknown kind resolves to `decimal` rather than
 * throwing: a document saved by an app with a custom kind still opens in one
 * without it, and its tag survives untouched.
 */
export function displayKindOf(display: Display | undefined): DisplayKind<Display> {
  const kind = display === undefined ? undefined : KINDS.get(display.kind);
  return (kind ?? decimalKind) as unknown as DisplayKind<Display>;
}

/** Options for presenting or parsing a quantity. */
export interface PresentOptions {
  /** BCP 47 locale. Defaults to {@link defaultLocale}: the browser's, else `en-US`. */
  locale?: string;
}

/** A quantity as text, spoken text, HTML and, where its kind has one, MathML. */
export interface Presentation {
  text: string;
  spoken: string;
  /** Unstyled: a `<data value>` wrapping one `<span data-part>` per named part. A toned value's `<data>` carries
   *  `data-tone`, the tone's name or else its index, for a stylesheet to color. */
  html: string;
  mathml?: string;
  /** The display's `form` is `stacked` and there is a `mathml` form: a
   *  renderer that draws MathML draws it in place of `html`. */
  stacked?: true;
  /** The value's tone, when its display has `tones`. */
  tone?: ValueTone;
}

const DEFAULT_DISPLAY: Display = { kind: 'decimal' };

/** The context a kind formats `q` in: the locale, and the unit `q` is tagged with. */
export function contextFor(q: Quantity, options: PresentOptions | undefined): FormatContext {
  const unit = unitOf(q);
  const locale = options?.locale ?? defaultLocale();
  return unit === undefined ? { locale } : { locale, unit };
}

/** Parts as the unstyled HTML fragment {@link Presentation.html} describes. */
export function partsToHtml(value: number, parts: readonly Part[], tone?: ValueTone): string {
  const toned = tone === undefined ? '' : ` data-tone="${escape(tone.name ?? String(tone.index))}"`;
  return `<data value="${escape(String(value))}"${toned}>${partsHtml(parts)}</data>`;
}

/** Parts as HTML with no `<data>` around them: a `<span data-part>` per named part. */
export function partsHtml(parts: readonly Part[]): string {
  return parts
    .map((p) => (p.type === 'literal' ? escape(p.value) : `<span data-part="${escape(p.type)}">${escape(p.value)}</span>`))
    .join('');
}

/** Parts of `q` under its own display, else `fallback`, else `decimal`. */
export function partsOf(q: Quantity, fallback?: Display, options?: PresentOptions): Part[] {
  const display = displayOf(q, fallback) ?? DEFAULT_DISPLAY;
  const value = amount(q);
  if (isInfinite(value)) return infinityParts(value, display);
  return displayKindOf(display).format(value, display, contextFor(q, options));
}

/** `q` as text, spoken text, HTML and MathML. See {@link qty} for one at a time. */
export function present(q: Quantity, fallback?: Display, options?: PresentOptions): Presentation {
  const display = displayOf(q, fallback) ?? DEFAULT_DISPLAY;
  const kind = displayKindOf(display);
  const value = amount(q);
  const tone = display.tones === undefined ? undefined : toneAt(display.tones, value);
  const toned = (out: Presentation): Presentation => {
    if (tone === undefined) return out;
    return { ...out, spoken: spokenTone(out.spoken, tone, display.tones), tone };
  };
  if (isInfinite(value)) {
    const word = infinityWord(display, value > 0 ? 1 : -1);
    return toned({ text: word.text, spoken: word.spoken, html: partsToHtml(value, infinityParts(value, display), tone) });
  }
  const ctx = contextFor(q, options);
  const parts = kind.format(value, display, ctx);
  const text = textOf(parts);
  const out: Presentation = {
    text,
    spoken: kind.speak ? kind.speak(value, display, ctx) : spokenSign(text),
    html: partsToHtml(value, parts, tone),
  };
  const mathml = kind.mathml?.(value, display, ctx);
  if (mathml !== undefined) {
    out.mathml = mathml;
    if (display.form === 'stacked') out.stacked = true;
  }
  return toned(out);
}

function isInfinite(value: number): boolean {
  return value === Infinity || value === -Infinity;
}

/** Typed text read through `display`: NaN when it does not read. ±Infinity
 *  reads from the display's own word for it, and from `∞` or `infinity`. */
export function parseAs(text: string, display?: Display, options?: PresentOptions & { unit?: Unit }): number {
  const d = display ?? DEFAULT_DISPLAY;
  const kind = displayKindOf(d);
  const ctx: FormatContext = { locale: options?.locale ?? defaultLocale() };
  const infinite = readInfinity(text, d, ctx.locale);
  if (infinite !== undefined) return infinite;
  if (options?.unit !== undefined) ctx.unit = options.unit;
  return kind.parse ? kind.parse(text, d, ctx) : parseNumberIn(text, undefined, ctx.locale);
}
