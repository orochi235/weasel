import { textOf, type DisplayKind, type FormatContext, type Part } from './kind';
import { compactKind, decimalKind, integerKind } from './kinds/plain';
import { fractionKind, multiplierKind, percentKind, ratioKind, zoomKind } from './kinds/proportion';
import { bytesKind, currencyKind, durationKind, unitKind } from './kinds/measure';
import { ordinalKind, romanKind } from './kinds/numeral';
import { parseNumber } from './number';
import { amount, displayOf, retag, tag, unitOf, type Display, type Quantity, type Tagged } from './quantity';
import { unitScale, type Unit, type UnitSystem } from './units';

// A static table rather than registration at import, so the package stays
// free of side effects and a bundler can drop what nobody imports.
const BUILTIN: Record<string, DisplayKind<never>> = Object.fromEntries(
  [
    decimalKind, integerKind, compactKind,
    percentKind, fractionKind, ratioKind, multiplierKind, zoomKind,
    unitKind, currencyKind, durationKind, bytesKind,
    romanKind, ordinalKind,
  ].map((k) => [k.kind, k as DisplayKind<never>]),
);

const registered = new Map<string, DisplayKind<never>>();

/**
 * Adds a display kind, or replaces a built-in one — the way to swap in a words
 * library for `fraction`'s spoken form (`{ ...fractionKind, speak }`). Returns
 * a function that removes it again.
 */
export function registerDisplayKind<D extends Display>(kind: DisplayKind<D>): () => void {
  const entry = kind as unknown as DisplayKind<never>;
  registered.set(kind.kind, entry);
  return () => {
    if (registered.get(kind.kind) === entry) registered.delete(kind.kind);
  };
}

/**
 * The kind behind `display`. An unknown kind resolves to `decimal` rather than
 * throwing: a document saved by an app with a custom kind still opens in one
 * without it, and its tag survives untouched.
 */
export function displayKindOf(display: Display | undefined): DisplayKind<Display> {
  const kind = display === undefined ? undefined : (registered.get(display.kind) ?? BUILTIN[display.kind]);
  return (kind ?? decimalKind) as unknown as DisplayKind<Display>;
}

/** Options for presenting or parsing a quantity. */
export interface PresentOptions {
  /** BCP 47 locale. Default `en-US`. */
  locale?: string;
}

/** A quantity as text, spoken text, HTML and, where its kind has one, MathML. */
export interface Presentation {
  text: string;
  spoken: string;
  /** Unstyled: a `<data value>` wrapping one `<span data-part>` per named part. */
  html: string;
  mathml?: string;
}

const DEFAULT_DISPLAY: Display = { kind: 'decimal' };

function contextOf(q: Quantity, options: PresentOptions | undefined): FormatContext {
  const unit = unitOf(q);
  return unit === undefined ? { locale: options?.locale ?? 'en-US' } : { locale: options?.locale ?? 'en-US', unit };
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
function escape(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ESCAPES[c]!);
}

/** Parts as the unstyled HTML fragment {@link Presentation.html} describes. */
export function partsToHtml(value: number, parts: readonly Part[]): string {
  const body = parts
    .map((p) => (p.type === 'literal' ? escape(p.value) : `<span data-part="${escape(p.type)}">${escape(p.value)}</span>`))
    .join('');
  return `<data value="${escape(String(value))}">${body}</data>`;
}

/** Parts of `q` under its own display, else `fallback`, else `decimal`. */
export function partsOf(q: Quantity, fallback?: Display, options?: PresentOptions): Part[] {
  const display = displayOf(q, fallback) ?? DEFAULT_DISPLAY;
  return displayKindOf(display).format(amount(q), display, contextOf(q, options));
}

/** `q` as text, spoken text, HTML and MathML. See {@link qty} for one at a time. */
export function present(q: Quantity, fallback?: Display, options?: PresentOptions): Presentation {
  const display = displayOf(q, fallback) ?? DEFAULT_DISPLAY;
  const kind = displayKindOf(display);
  const value = amount(q);
  const ctx = contextOf(q, options);
  const parts = kind.format(value, display, ctx);
  const text = textOf(parts);
  const out: Presentation = {
    text,
    spoken: kind.speak ? kind.speak(value, display, ctx) : text,
    html: partsToHtml(value, parts),
  };
  const mathml = kind.mathml?.(value, display, ctx);
  if (mathml !== undefined) out.mathml = mathml;
  return out;
}

/** Typed text read through `display`: NaN when it does not read. */
export function parseAs(text: string, display?: Display, options?: PresentOptions & { unit?: Unit }): number {
  const d = display ?? DEFAULT_DISPLAY;
  const kind = displayKindOf(d);
  const ctx: FormatContext = { locale: options?.locale ?? 'en-US' };
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
