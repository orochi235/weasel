/**
 * SVG style cascade: presentation attributes, `<style>` rules, `style=""`, inheritance.
 *
 * Most SVG paint/text properties inherit down the element tree. Rather than
 * re-walking the DOM parent chain per attribute at leaf-emit time, the parser
 * threads a resolved `StyleContext` down through the recursion (alongside the
 * transform matrix): at each element we fold the element's own cascaded values onto
 * the inherited cascade once, and leaves read resolved values directly.
 */

/**
 * Raw resolved value of each inheritable presentation property in effect at a
 * point in the tree. An absent key means the property is unset all the way up,
 * and the consumer applies its own default (matching the pre-cascade
 * `readInheritedAttr` → null contract). Values are raw SVG strings; callers
 * parse them (color, number, keyword, …).
 */
export type StyleContext = Readonly<Record<string, string>>;

/** The empty cascade — seeds the root. */
export const EMPTY_STYLE: StyleContext = {};

/**
 * Inheritable presentation properties the leaf/text parsers consume. Extend
 * this list (and teach the consuming leaf to read the new key) to inherit a
 * new property — no per-attribute DOM walk required.
 */
const INHERITABLE = [
  'fill', 'fill-opacity', 'fill-rule',
  'stroke', 'stroke-width', 'stroke-opacity',
  'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-miterlimit',
  'marker-start', 'marker-mid', 'marker-end',
  'color',
  'font-size', 'font-family', 'font-weight', 'font-style', 'text-anchor',
  'letter-spacing', 'text-decoration', 'direction',
] as const;

/** One `prop: value [!important]` declaration. */
export interface Declaration {
  readonly prop: string;
  readonly value: string;
  readonly important: boolean;
}

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

/**
 * Advance past a quoted string starting at `i` (which holds the quote).
 * Returns the index just after the closing quote, or the end of input.
 */
function skipString(s: string, i: number): number {
  const q = s[i];
  for (let j = i + 1; j < s.length; j++) {
    if (s[j] === '\\') j++;
    else if (s[j] === q) return j + 1;
  }
  return s.length;
}

/** Remove `/* … *\/` comments, leaving quoted strings intact. */
function stripComments(s: string): string {
  if (!s.includes('/*')) return s;
  let out = '';
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '"' || ch === "'") {
      const end = skipString(s, i);
      out += s.slice(i, end);
      i = end;
    } else if (ch === '/' && s[i + 1] === '*') {
      const end = s.indexOf('*/', i + 2);
      i = end < 0 ? s.length : end + 2;
      out += ' ';
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

/**
 * Split `s` on `sep` wherever it sits outside strings and (), [] nesting.
 * With `dropBlocks`, a `{…}` block at depth zero is discarded along with the
 * prelude before it, back to the previous separator.
 */
function splitTopLevel(s: string, sep: string, dropBlocks = false): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '"' || ch === "'") { i = skipString(s, i); continue; }
    if (ch === '(' || ch === '[') depth++;
    else if ((ch === ')' || ch === ']') && depth > 0) depth--;
    else if (depth === 0 && ch === sep) {
      parts.push(s.slice(start, i));
      start = i + 1;
    } else if (depth === 0 && dropBlocks && ch === '{') {
      i = skipBlock(s, i);
      start = i;
      continue;
    }
    i++;
  }
  parts.push(s.slice(start));
  return parts;
}

/** Given `s[i] === '{'`, return the index just after its matching `}`. */
function skipBlock(s: string, i: number): number {
  let depth = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '"' || ch === "'") { i = skipString(s, i); continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return i + 1;
    i++;
  }
  return s.length;
}

const PROP_NAME = /^-?[a-z_][a-z0-9_-]*$/;
const IMPORTANT = /!\s*important\s*$/i;

/**
 * Parse a CSS declaration block — a `style=""` value or a rule body — in
 * source order. Malformed declarations are dropped, as CSS does.
 */
export function parseDeclarations(block: string): Declaration[] {
  const out: Declaration[] = [];
  for (const part of splitTopLevel(stripComments(block), ';', true)) {
    const colon = part.indexOf(':');
    if (colon < 0) continue;
    const prop = part.slice(0, colon).trim().toLowerCase();
    if (!PROP_NAME.test(prop)) continue;
    let value = part.slice(colon + 1).trim();
    const important = IMPORTANT.test(value);
    if (important) value = value.replace(IMPORTANT, '').trim();
    if (!value) continue;
    out.push({ prop, value, important });
  }
  return out;
}

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

/** Given `s[i] === '('`, return the index just after its matching `)`. */
function parenEnd(s: string, i: number): number {
  let depth = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '"' || ch === "'") { i = skipString(s, i); continue; }
    if (ch === '(') depth++;
    else if (ch === ')' && --depth === 0) return i + 1;
    i++;
  }
  return s.length;
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

/**
 * Parse stylesheet text into rules. Every at-rule (`@media`, `@import`,
 * `@font-face`, `@supports`, …) is skipped whole, as are nested blocks inside
 * a rule body. `order` continues from `firstOrder` so several sheets share one
 * source order.
 */
export function parseStylesheet(text: string, firstOrder = 0): StyleRule[] {
  const src = stripComments(text).replace(/<!\[CDATA\[|\]\]>|<!--|-->/g, ' ');
  const rules: StyleRule[] = [];
  let order = firstOrder;
  let i = 0;
  let preludeStart = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"' || ch === "'") { i = skipString(src, i); continue; }
    if (ch === ';') {
      i++;
      preludeStart = i;
      continue;
    }
    if (ch !== '{') { i++; continue; }
    const prelude = src.slice(preludeStart, i).trim();
    const end = skipBlock(src, i);
    if (!prelude.startsWith('@') && prelude) {
      const declarations = parseDeclarations(src.slice(i + 1, end - 1));
      for (const raw of splitTopLevel(prelude, ',')) {
        const selector = raw.trim();
        if (selector) {
          rules.push({ selector, declarations, specificity: specificity(selector), order: order++ });
        }
      }
    }
    i = end;
    preludeStart = end;
  }
  return rules;
}

function appliesAsCss(style: Element): boolean {
  const type = style.getAttribute('type')?.trim().toLowerCase();
  if (type && type !== 'text/css') return false;
  const media = style.getAttribute('media')?.trim().toLowerCase();
  if (!media) return true;
  return media.split(',').some((m) => m.trim() === 'all' || m.trim() === 'screen');
}

/** Rules sorted ascending by (specificity, source order) — the cascade's order. */
const sheetCache = new WeakMap<Document, readonly StyleRule[]>();

function documentRules(doc: Document): readonly StyleRule[] {
  const cached = sheetCache.get(doc);
  if (cached) return cached;
  const rules: StyleRule[] = [];
  const styles = doc.getElementsByTagNameNS('*', 'style');
  for (let i = 0; i < styles.length; i++) {
    if (!appliesAsCss(styles[i])) continue;
    rules.push(...parseStylesheet(styles[i].textContent ?? '', rules.length));
  }
  rules.sort((x, y) => compareSpecificity(x.specificity, y.specificity) || x.order - y.order);
  sheetCache.set(doc, rules);
  return rules;
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
export function ownProp(el: Element, prop: string): string | null {
  return authorDeclarations(el).get(prop) ?? el.getAttribute(prop);
}

/**
 * Fold an element's own cascaded values ({@link ownProp}) onto the inherited cascade.
 * A property that is absent or literally `inherit` keeps the parent value;
 * any other own value overrides. Returns the parent unchanged (same object)
 * when the element sets no inheritable property, avoiding a needless clone.
 */
export function deriveStyle(parent: StyleContext, el: Element): StyleContext {
  let next: Record<string, string> | null = null;
  for (const prop of INHERITABLE) {
    const own = ownProp(el, prop);
    if (own == null || own === 'inherit') continue;
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
  if (raw.trim().toLowerCase() === 'currentcolor') return style['color'] ?? '#000000';
  return raw;
}
