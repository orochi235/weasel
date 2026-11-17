import { createReflectable, type Reflection } from '@weasel-js/registry';
import { escapeMarkup as escape, textOf, type DisplayKind, type FormatContext, type Part } from './kind';
import { compactKind, decimalKind, integerKind } from './kinds/plain';
import { fractionKind, multiplierKind, percentKind, ratioKind, zoomKind } from './kinds/proportion';
import { bytesKind, currencyKind, durationKind, unitKind } from './kinds/measure';
import { ordinalKind, romanKind } from './kinds/numeral';
import { scientificKind } from './kinds/scientific';
import { infinityParts, infinityWord, readInfinity } from './infinity';
import { parseNumber } from './number';
import { defaultLocale } from './fieldLocale';
import { amount, displayOf, retag, tag, unitOf, type Display, type Quantity, type Tagged } from './quantity';
import { unitScale, type Unit, type UnitSystem } from './units';

// Seeded from a static table rather than by each kind registering itself at import, so the package stays
// free of side effects and a bundler can drop what nobody imports.
const KINDS = createReflectable<DisplayKind<never>>({ name: 'display kinds' });
for (const k of [
  decimalKind, integerKind, compactKind, scientificKind,
  percentKind, fractionKind, ratioKind, multiplierKind, zoomKind,
  unitKind, currencyKind, durationKind, bytesKind,
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
  /** Unstyled: a `<data value>` wrapping one `<span data-part>` per named part. */
  html: string;
  mathml?: string;
  /** The display's `form` is `stacked` and there is a `mathml` form: a
   *  renderer that draws MathML draws it in place of `html`. */
  stacked?: true;
}

const DEFAULT_DISPLAY: Display = { kind: 'decimal' };

function contextOf(q: Quantity, options: PresentOptions | undefined): FormatContext {
  const unit = unitOf(q);
  const locale = options?.locale ?? defaultLocale();
  return unit === undefined ? { locale } : { locale, unit };
}

/** Parts as the unstyled HTML fragment {@link Presentation.html} describes. */
export function partsToHtml(value: number, parts: readonly Part[]): string {
  return `<data value="${escape(String(value))}">${partsHtml(parts)}</data>`;
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
  return displayKindOf(display).format(value, display, contextOf(q, options));
}

/** `q` as text, spoken text, HTML and MathML. See {@link qty} for one at a time. */
export function present(q: Quantity, fallback?: Display, options?: PresentOptions): Presentation {
  const display = displayOf(q, fallback) ?? DEFAULT_DISPLAY;
  const kind = displayKindOf(display);
  const value = amount(q);
  if (isInfinite(value)) {
    const word = infinityWord(display, value > 0 ? 1 : -1);
    return { text: word.text, spoken: word.spoken, html: partsToHtml(value, infinityParts(value, display)) };
  }
  const ctx = contextOf(q, options);
  const parts = kind.format(value, display, ctx);
  const text = textOf(parts);
  const out: Presentation = {
    text,
    spoken: kind.speak ? kind.speak(value, display, ctx) : text,
    html: partsToHtml(value, parts),
  };
  const mathml = kind.mathml?.(value, display, ctx);
  if (mathml !== undefined) {
    out.mathml = mathml;
    if (display.form === 'stacked') out.stacked = true;
  }
  return out;
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
  return kind.parse ? kind.parse(text, d, ctx) : parseNumber(text, undefined, ctx.locale);
}

/**
 * A short-lived view of a quantity with its presentation as methods. Nothing
 * about it is stored — keep the quantity, and wrap it where it is shown.
 */
export class QuantityView<Q extends Quantity = Quantity> {
  constructor(
    /** The quantity as given. */
    readonly raw: Q,
    private readonly fallback?: Display,
    private readonly options?: PresentOptions,
  ) {}

  get value(): number {
    return amount(this.raw);
  }
  get unit(): Unit | undefined {
    return unitOf(this.raw);
  }
  /** The display in effect: the value's own, else the fallback. */
  get display(): Display | undefined {
    return displayOf(this.raw, this.fallback);
  }
  get parts(): Part[] {
    return partsOf(this.raw, this.fallback, this.options);
  }
  get text(): string {
    return textOf(this.parts);
  }
  get spoken(): string {
    return present(this.raw, this.fallback, this.options).spoken;
  }
  get html(): string {
    return partsToHtml(this.value, this.parts);
  }
  get mathml(): string | undefined {
    return present(this.raw, this.fallback, this.options).mathml;
  }
  /** `next` in this quantity's shape — see {@link retag}. */
  with(next: number): QuantityView<Q> {
    return new QuantityView(retag(this.raw, next), this.fallback, this.options);
  }
  /** Typed text read through this quantity's display; NaN when it does not read. */
  parse(text: string): number {
    const unit = this.unit;
    return parseAs(text, this.display, unit === undefined ? this.options : { ...this.options, unit });
  }
  /** The same amount in `target`, converted through `system`, tagged with it. */
  to(target: Unit, system: UnitSystem): QuantityView {
    const from = unitScale(system, this.unit ?? system.base);
    const to = unitScale(system, target);
    const base = this.value * from.factor + from.offset;
    const value = (base - to.offset) / to.factor;
    const raw = typeof this.raw === 'number' ? tag(value, undefined, target) : { ...(this.raw as Tagged), value, unit: target };
    return new QuantityView(raw, this.fallback, this.options);
  }
  toJSON(): Q {
    return this.raw;
  }
}

/** Wraps `q` for display: `qty(band.from, fraction()).text`. `fallback` is the
 *  display for a value that carries none of its own. */
export function qty<Q extends Quantity>(q: Q, fallback?: Display, options?: PresentOptions): QuantityView<Q> {
  return new QuantityView(q, fallback, options);
}
