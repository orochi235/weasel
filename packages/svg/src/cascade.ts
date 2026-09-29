/**
 * SVG style cascade: presentation attributes, `<style>` rules, `style=""`, inheritance.
 *
 * Most SVG paint/text properties inherit down the element tree. Rather than
 * re-walking the DOM parent chain per attribute at leaf-emit time, the parser
 * threads a resolved `StyleContext` down through the recursion (alongside the
 * transform matrix): at each element we fold the element's own cascaded values onto
 * the inherited cascade once, and leaves read resolved values directly.
 */

import {
  parenEnd, parseDeclarations, skipBlock, skipString, splitTopLevel, stripComments, type Declaration,
} from './cssScan';
import {
  DEFAULT_MEDIA_ENVIRONMENT, evaluateMediaQuery, mediaEnvironmentFor, type SvgMediaEnvironment,
} from './media';
import {
  INHERITED_PROPERTIES, readProperty, type InheritedPropertyName, type PropertyName, type PropertyValue, type Warn,
} from './properties';
import { evaluateSupports } from './supports';

export { parseDeclarations, type Declaration };

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

/** One selector from a style rule; a comma list becomes one rule per selector. */
export interface StyleRule {
  readonly selector: string;
  readonly declarations: readonly Declaration[];
  /** `[ids, classes/attributes/pseudo-classes, types/pseudo-elements]`. */
  readonly specificity: Specificity;
  /** Source position across every `<style>` in the document. */
  readonly order: number;
}

export type Specificity = readonly [number, number, number];

/** Read an identifier (with escapes) starting at `i`; returns its end index. */
function identEnd(s: string, i: number): number {
  while (i < s.length) {
    const ch = s[i];
    if (ch === '\\') i += 2;
    else if (/[\w-]/.test(ch) || ch.charCodeAt(0) > 0x7f) i++;
    else break;
  }
  return i;
}

const LEGACY_PSEUDO_ELEMENTS = new Set(['before', 'after', 'first-line', 'first-letter']);
const MAX_ARG_PSEUDOS = new Set(['not', 'is', 'matches', '-webkit-any', 'has']);

function compareSpecificity(a: Specificity, b: Specificity): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

function maxSpecificity(list: string): Specificity {
  let best: Specificity = [0, 0, 0];
  for (const sel of splitTopLevel(list, ',')) {
    const s = specificity(sel);
    if (compareSpecificity(s, best) > 0) best = s;
  }
  return best;
}

/** CSS Selectors 4 specificity of one complex selector (no comma list). */
export function specificity(selector: string): Specificity {
  let a = 0, b = 0, c = 0;
  const s = selector;
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '#') {
      a++;
      i = identEnd(s, i + 1);
    } else if (ch === '.') {
      b++;
      i = identEnd(s, i + 1);
    } else if (ch === '[') {
      b++;
      while (i < s.length && s[i] !== ']') {
        i = s[i] === '"' || s[i] === "'" ? skipString(s, i) : i + 1;
      }
      i++;
    } else if (ch === ':') {
      const element = s[i + 1] === ':';
      const nameStart = i + (element ? 2 : 1);
      const nameEnd = identEnd(s, nameStart);
      const name = s.slice(nameStart, nameEnd).toLowerCase();
      let arg: string | null = null;
      i = nameEnd;
      if (s[i] === '(') {
        const end = parenEnd(s, i);
        arg = s.slice(i + 1, end - 1);
        i = end;
      }
      if (element || LEGACY_PSEUDO_ELEMENTS.has(name)) c++;
      else if (name === 'where') { /* contributes nothing */ }
      else if (MAX_ARG_PSEUDOS.has(name) && arg != null) {
        const m = maxSpecificity(arg);
        a += m[0]; b += m[1]; c += m[2];
      } else b++;
    } else if (/[a-zA-Z_\\-]/.test(ch) || ch.charCodeAt(0) > 0x7f) {
      c++;
      i = identEnd(s, i);
    } else {
      i++;
    }
  }
  return [a, b, c];
}

/** What a stylesheet's conditional at-rules are evaluated against. */
export interface StylesheetContext {
  /** The environment `@media` answers to; {@link DEFAULT_MEDIA_ENVIRONMENT} when omitted. */
  readonly media?: SvgMediaEnvironment;
  /** Answers `@supports selector(…)`; every selector test is false without it. */
  readonly selector?: (selector: string) => boolean;
  /** Receives a notice for each `@import`, which is never fetched. */
  readonly onWarn?: (message: string) => void;
}

/**
 * Parse stylesheet text into rules. `@media` and `@supports` blocks
 * contribute their rules when their condition holds against `ctx`, nested to
 * any depth; `@import` is reported and not fetched; every other at-rule
 * (`@font-face`, `@layer`, `@keyframes`, …) is skipped whole, as are nested
 * blocks inside a rule body. `order` continues from `firstOrder` so several
 * sheets share one source order.
 */
export function parseStylesheet(text: string, firstOrder = 0, ctx: StylesheetContext = {}): StyleRule[] {
  const src = stripComments(text).replace(/<!\[CDATA\[|\]\]>|<!--|-->/g, ' ');
  const rules: StyleRule[] = [];
  parseRuleList(src, 0, src.length, ctx, rules, { order: firstOrder, importsAllowed: true });
  return rules;
}

const AT_RULE = /^@([\w-]+)\s*([\s\S]*)$/;

interface ListState {
  order: number;
  /** `@import` is valid only at the top of a sheet, ahead of every rule but `@charset` and `@layer`. */
  importsAllowed: boolean;
}

function parseRuleList(
  src: string, from: number, to: number, ctx: StylesheetContext, rules: StyleRule[], state: ListState,
): void {
  let i = from;
  let preludeStart = from;
  while (i < to) {
    const ch = src[i];
    if (ch === '"' || ch === "'") { i = skipString(src, i); continue; }
    if (ch === ';') {
      const text = src.slice(preludeStart, i).trim();
      const statement = AT_RULE.exec(text);
      const name = statement?.[1].toLowerCase();
      if (name === 'import' && state.importsAllowed) {
        ctx.onWarn?.(`@import ${statement?.[2]} is not fetched; its rules do not apply`);
      } else if (text && name !== 'charset' && name !== 'layer') {
        state.importsAllowed = false;
      }
      i++;
      preludeStart = i;
      continue;
    }
    if (ch !== '{') { i++; continue; }
    const prelude = src.slice(preludeStart, i).trim();
    const end = Math.min(skipBlock(src, i), to);
    const at = AT_RULE.exec(prelude);
    state.importsAllowed = false;
    if (at) {
      if (conditionHolds(at[1].toLowerCase(), at[2], ctx)) parseRuleList(src, i + 1, end - 1, ctx, rules, state);
    } else if (prelude) {
      const declarations = parseDeclarations(src.slice(i + 1, end - 1));
      for (const raw of splitTopLevel(prelude, ',')) {
        const selector = raw.trim();
        if (selector) {
          rules.push({ selector, declarations, specificity: specificity(selector), order: state.order++ });
        }
      }
    }
    i = end;
    preludeStart = end;
  }
}

function conditionHolds(name: string, condition: string, ctx: StylesheetContext): boolean {
  if (name === 'media') return evaluateMediaQuery(condition, ctx.media ?? DEFAULT_MEDIA_ENVIRONMENT);
  if (name === 'supports') return evaluateSupports(condition, { selector: ctx.selector });
  return false;
}

function appliesAsCss(style: Element, ctx: StylesheetContext): boolean {
  const type = style.getAttribute('type')?.trim().toLowerCase();
  if (type && type !== 'text/css') return false;
  return evaluateMediaQuery(style.getAttribute('media') ?? '', ctx.media ?? DEFAULT_MEDIA_ENVIRONMENT);
}

/** Rules sorted ascending by (specificity, source order) — the cascade's order. */
const sheetCache = new WeakMap<Document, readonly StyleRule[]>();

/**
 * Evaluate `doc`'s stylesheets against `media` now, reporting to `onWarn`.
 * A document never bound is read on first use against the environment its
 * root implies, with nothing reported.
 */
export function bindStylesheets(
  doc: Document, media: SvgMediaEnvironment, onWarn?: (message: string) => void,
): void {
  sheetCache.set(doc, collectRules(doc, media, onWarn));
}

function documentRules(doc: Document): readonly StyleRule[] {
  const cached = sheetCache.get(doc);
  if (cached) return cached;
  const root = doc.documentElement;
  const rules = collectRules(doc, root ? mediaEnvironmentFor(root) : DEFAULT_MEDIA_ENVIRONMENT);
  sheetCache.set(doc, rules);
  return rules;
}

function collectRules(
  doc: Document, media: SvgMediaEnvironment, onWarn?: (message: string) => void,
): readonly StyleRule[] {
  const ctx: StylesheetContext = { media, onWarn, selector: (s) => isValidSelector(doc, s) };
  const rules: StyleRule[] = [];
  const styles = doc.getElementsByTagNameNS('*', 'style');
  for (let i = 0; i < styles.length; i++) {
    if (!appliesAsCss(styles[i], ctx)) continue;
    rules.push(...parseStylesheet(styles[i].textContent ?? '', rules.length, ctx));
  }
  rules.sort((x, y) => compareSpecificity(x.specificity, y.specificity) || x.order - y.order);
  return rules;
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

/**
 * The cascaded value of every property an author rule or `style=""` sets on
 * `el`. Lowest to highest: normal rules, normal inline, `!important` rules,
 * `!important` inline (CSS Cascade 4). Presentation attributes sit below all
 * of these and are left to {@link ownProp}.
 */
function authorDeclarations(el: Element): ReadonlyMap<string, string> {
  const cached = elementCache.get(el);
  if (cached) return cached;
  const rules = el.ownerDocument ? documentRules(el.ownerDocument) : [];
  const matched = rules.filter((r) => matches(el, r.selector));
  const inline = parseDeclarations(el.getAttribute('style') ?? '');
  const out = new Map<string, string>();
  for (const important of [false, true]) {
    for (const r of matched) {
      for (const d of r.declarations) if (d.important === important) out.set(d.prop, d.value);
    }
    for (const d of inline) if (d.important === important) out.set(d.prop, d.value);
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
  return authorDeclarations(el).get(prop) ?? el.getAttribute(prop);
}

/**
 * Fold an element's own cascaded values ({@link ownProp}) onto the inherited cascade.
 * A property that is absent or literally `inherit` keeps the parent value;
 * any other own value overrides. Returns the parent unchanged (same object)
 * when the element sets no inheritable property, avoiding a needless clone.
 */
export function deriveStyle(parent: StyleContext, el: Element): StyleContext {
  let next: Partial<Record<InheritedPropertyName, string>> | null = null;
  for (const prop of INHERITED_PROPERTIES) {
    const own = ownProp(el, prop);
    // `color: currentColor` is `inherit` by another name (CSS Color 4).
    if (own == null || own === 'inherit' || (prop === 'color' && own.trim().toLowerCase() === 'currentcolor')) continue;
    if (!next) next = { ...parent };
    next[prop] = own;
  }
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
export function ownValue<K extends PropertyName>(el: Element, prop: K, warn?: Warn): PropertyValue<K> | undefined {
  return readProperty(prop, ownProp(el, prop), warn);
}

/** The inherited value of `prop` in effect at `style`, read by the property's one reader. */
export function styleValue<K extends InheritedPropertyName>(
  style: StyleContext, prop: K, warn?: Warn,
): PropertyValue<K> | undefined {
  return readProperty(prop, style[prop], warn);
}
