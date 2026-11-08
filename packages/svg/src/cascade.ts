/**
 * SVG style cascade: presentation attributes, `<style>` rules, `style=""`, inheritance.
 *
 * Most SVG paint/text properties inherit down the element tree. Rather than
 * re-walking the DOM parent chain per attribute at leaf-emit time, the parser
 * threads a resolved `StyleContext` down through the recursion (alongside the
 * transform matrix): at each element we fold the element's own cascaded values onto
 * the inherited cascade once, and leaves read resolved values directly.
 */

import { parseDeclarations, type Declaration } from './cssScan';
import { containerQueryHolds, queryContainerOf } from './container';
import { compareSpecificity, specificity, type Specificity } from './specificity';
import {
  DEFAULT_MEDIA_ENVIRONMENT, evaluateMediaQuery, mediaEnvironmentFor, type SvgMediaEnvironment,
} from './media';
import {
  INHERITED_PROPERTIES, isDeclarationInvalid, PROPERTIES, readProperty, type InheritedPropertyName, type PropertyName, type PropertyValue, type Warn,
} from './properties';
import {
  CascadeLayers, parseStylesheet, type StyleRule, type StylesheetContext,
} from './stylesheet';
import { computeFontRelative, fontSizeOf } from './fontSize';

export { parseDeclarations, specificity, type Declaration, type Specificity };
export { CascadeLayers, parseStylesheet, type StyleRule, type StylesheetContext };

/**
 * Raw resolved value of each inheritable presentation property in effect at a
 * point in the tree. An absent key means the property is unset all the way up,
 * and the consumer applies its own default (matching the pre-cascade
 * `readInheritedAttr` → null contract). Values are raw SVG strings; callers
 * parse them (color, number, keyword, …).
 */
export type StyleContext = Readonly<Partial<Record<InheritedPropertyName, string>>>;

/** The empty cascade — seeds the root. */
export const EMPTY_STYLE: StyleContext = {};

function appliesAsCss(style: Element, ctx: StylesheetContext): boolean {
  const type = style.getAttribute('type')?.trim().toLowerCase();
  if (type && type !== 'text/css') return false;
  return evaluateMediaQuery(style.getAttribute('media') ?? '', ctx.media ?? DEFAULT_MEDIA_ENVIRONMENT);
}

/** A rule with its layer's rank for normal declarations; `!important` reverses it. */
interface RankedRule extends StyleRule {
  readonly rank: number;
}

/** A document's rules, sorted ascending by (layer rank, specificity, source order): the cascade's order for normal
 *  declarations. `media` is what they were evaluated against, and sizes the root as a query container. */
interface BoundSheet {
  readonly rules: readonly RankedRule[];
  readonly media: SvgMediaEnvironment;
  readonly onWarn?: (message: string) => void;
}

const sheetCache = new WeakMap<Document, BoundSheet>();

/**
 * Evaluate `doc`'s stylesheets against `media` now, reporting to `onWarn`.
 * A document never bound is read on first use against the environment its
 * root implies, with nothing reported.
 */
export function bindStylesheets(
  doc: Document, media: SvgMediaEnvironment, onWarn?: (message: string) => void,
): void {
  sheetCache.set(doc, { rules: collectRules(doc, media, onWarn), media, onWarn });
}

function documentSheet(doc: Document): BoundSheet {
  const cached = sheetCache.get(doc);
  if (cached) return cached;
  const root = doc.documentElement;
  const media = root ? mediaEnvironmentFor(root) : DEFAULT_MEDIA_ENVIRONMENT;
  const sheet = { rules: collectRules(doc, media), media };
  sheetCache.set(doc, sheet);
  return sheet;
}

/**
 * Whether every `@container` query around a rule holds for `el`. Only the
 * root `<svg>` has a box a static parse knows the size of, so it is the one
 * query container, and the root itself has none above it to be queried.
 */
function containersHold(el: Element, containers: readonly string[], media: SvgMediaEnvironment): boolean {
  const root = el.ownerDocument?.documentElement;
  if (!root || el === root) return false;
  const declared = cascaded(root);
  const container = queryContainerOf((prop) => declared.get(prop), media);
  return containers.every((prelude) => containerQueryHolds(prelude, container));
}

function collectRules(
  doc: Document, media: SvgMediaEnvironment, onWarn?: (message: string) => void,
): readonly RankedRule[] {
  const ctx: StylesheetContext = { media, onWarn, selector: (s) => isValidSelector(doc, s) };
  const layers = new CascadeLayers();
  const rules: StyleRule[] = [];
  const styles = doc.getElementsByTagNameNS('*', 'style');
  for (let i = 0; i < styles.length; i++) {
    if (!appliesAsCss(styles[i], ctx)) continue;
    rules.push(...parseStylesheet(styles[i].textContent ?? '', rules.length, ctx, layers));
  }
  const ranks = layers.ranks();
  return rules
    .map((r) => ({ ...r, rank: ranks.get(r.layer) ?? 0 }))
    .sort((x, y) => x.rank - y.rank || compareCascade(x, y));
}

function compareCascade(x: StyleRule, y: StyleRule): number {
  return compareSpecificity(x.specificity, y.specificity) || x.order - y.order;
}

function isValidSelector(doc: Document, selector: string): boolean {
  const root = doc.documentElement;
  if (!root || !selector.trim()) return false;
  try {
    root.matches(selector);
    return true;
  } catch {
    return false;
  }
}

function matches(el: Element, selector: string): boolean {
  try {
    return el.matches(selector);
  } catch {
    return false;
  }
}

const elementCache = new WeakMap<Element, ReadonlyMap<string, string>>();

const PROPERTY_NAMES = Object.keys(PROPERTIES) as PropertyName[];

/**
 * The cascaded value of every property `el` sets. Lowest to highest:
 * presentation attributes, normal rules, normal inline, `!important` rules,
 * `!important` inline (CSS Cascade 5, SVG2). Layers order the rules within
 * each importance, reversed for `!important`. A value CSS rejects is dropped,
 * as CSS drops it, so the one below it stands.
 */
function cascaded(el: Element): ReadonlyMap<string, string> {
  const cached = elementCache.get(el);
  if (cached) return cached;
  const sheet = el.ownerDocument && documentSheet(el.ownerDocument);
  const matched = (sheet ? sheet.rules : []).filter((r) => matches(el, r.selector)
    && (!r.containers || containersHold(el, r.containers, sheet!.media)));
  const inline = parseDeclarations(el.getAttribute('style') ?? '');
  const out = new Map<string, string>();
  const take = (prop: string, value: string, written: string): void => {
    if (!isDeclarationInvalid(prop, value)) out.set(prop, value);
    else sheet?.onWarn?.(`${written} is not a valid ${prop}; it is ignored, as CSS ignores it`);
  };
  for (const prop of PROPERTY_NAMES) {
    const attr = el.getAttribute(prop);
    if (attr != null) take(prop, attr, `${prop}="${attr}"`);
  }
  const importantOrder = [...matched].sort((x, y) => y.rank - x.rank || compareCascade(x, y));
  for (const [important, ordered] of [[false, matched], [true, importantOrder]] as const) {
    const declare = (d: Declaration): void => {
      if (d.important === important) take(d.prop, d.value, `${d.prop}: ${d.value}`);
    };
    for (const r of ordered) r.declarations.forEach(declare);
    inline.forEach(declare);
  }
  elementCache.set(el, out);
  return out;
}

/**
 * Resolve an element's own (cascaded, pre-inheritance) value for a property:
 * stylesheet rules and `style=""` by CSS precedence, then the presentation
 * attribute, which ranks below any author rule (SVG2).
 */
export function ownProp(el: Element, prop: PropertyName): string | null {
  return cascaded(el).get(prop) ?? null;
}

/** Whether a cascaded value of an inherited property hands on the parent's: `inherit`, or `unset`. */
export function keepsParent(value: string): boolean {
  const word = value.trim().toLowerCase();
  return word === 'inherit' || word === 'unset';
}

/** Whether `el` gives an inherited property a value of its own rather than taking its parent's. */
export function setsOwn(el: Element, prop: InheritedPropertyName): boolean {
  const own = ownProp(el, prop);
  return own != null && !keepsParent(own);
}

/**
 * Fold an element's own cascaded values ({@link ownProp}) onto the inherited cascade.
 * A property that is absent or literally `inherit` keeps the parent value;
 * any other own value overrides, and an `em` or `ex` in it is computed to user
 * units here, where its font size is known. Returns the parent unchanged (same object)
 * when the element sets no inheritable property, avoiding a needless clone.
 */
export function deriveStyle(parent: StyleContext, el: Element): StyleContext {
  let next: Partial<Record<InheritedPropertyName, string>> | null = null;
  for (const prop of INHERITED_PROPERTIES) {
    const own = ownProp(el, prop);
    // `color: currentColor` is `inherit` by another name (CSS Color 4).
    if (own == null || keepsParent(own) || (prop === 'color' && own.trim().toLowerCase() === 'currentcolor')) continue;
    if (!next) next = { ...parent };
    if (own.trim().toLowerCase() === 'initial') delete next[prop];
    else next[prop] = own;
  }
  if (next) computeFontRelative(next, fontSizeOf(parent));
  return next ?? parent;
}

/**
 * Resolve a paint value that may be the `currentColor` keyword against the
 * cascade's `color`. Non-currentColor values pass through; null passes through.
 * `color`'s SVG initial value is black.
 */
export function resolveCurrentColor(raw: string | null, style: StyleContext): string | null {
  if (raw == null) return null;
  if (raw.trim().toLowerCase() !== 'currentcolor') return raw;
  const color = readProperty('color', style['color']);
  return color == null || color.toLowerCase() === 'currentcolor' ? '#000000' : color;
}

/** An element's own value of `prop`, read by the property's one reader. */
export function ownValue<K extends PropertyName>(
  el: Element, prop: K, warn?: Warn, fontSize?: number,
): PropertyValue<K> | undefined {
  return readProperty(prop, ownProp(el, prop), warn, fontSize);
}

/** The inherited value of `prop` in effect at `style`, read by the property's one reader. */
export function styleValue<K extends InheritedPropertyName>(
  style: StyleContext, prop: K, warn?: Warn,
): PropertyValue<K> | undefined {
  return readProperty(prop, style[prop], warn);
}
