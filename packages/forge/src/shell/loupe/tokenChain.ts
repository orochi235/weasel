import { parseColor } from '@weasel-js/core';
import { type LoupePoint, probeUnderLens } from '@weasel-js/labkit/loupe';
import { compareSpecificity, type Specificity, specificity, splitTopLevel } from '@weasel-js/svg';
import { cssRulesOf, varRefs } from '../../frame/cssVarUse';

/** A color an element shows, and the property it shows it through. */
export interface ColorAt {
  element: Element;
  property: 'color' | 'background-color';
  /** The computed value. */
  value: string;
}

/** One declaration in a chain: what `property` is declared as, by which rule, on which element. */
export interface ChainLink {
  property: string;
  declared: string;
  selector: string;
  element: Element;
}

/** The selector a link reports for a declaration in an element's `style` attribute. */
export const INLINE = 'style attribute';

/**
 * The topmost element under a client point inside `within`, `within` itself included. Inside a lens the layer takes
 * no pointer, so the hit test runs under labkit's `interior` probe, which stands the lens's interior up for it.
 */
export function topmostIn(within: Element, client: LoupePoint): Element | undefined {
  return probeUnderLens(within, 'interior', () =>
    (within.ownerDocument.elementsFromPoint?.(client.x, client.y) ?? []).find((el) => within.contains(el)),
  );
}

/** The first opaque `background-color` from `el` up to `stop`; null when none is, or the unreadable color that stopped the walk. */
export function backgroundOf(
  el: Element,
  stop?: Element,
): { element: Element; color: string } | { unreadable: string } | null {
  for (let at: Element | null = el; at; at = at === stop ? null : at.parentElement) {
    const color = getComputedStyle(at).backgroundColor;
    if (color.trim() === '') continue;
    try {
      if (parseColor(color)[3] === 1) return { element: at, color };
    } catch {
      return { unreadable: color };
    }
  }
  return null;
}

const inside = (r: DOMRect, p: LoupePoint) => p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;

/** Whether one of `el`'s own text runs is drawn under the point: the text's range rects, not the element's box. */
function textUnder(el: Element, client: LoupePoint): boolean {
  const range = el.ownerDocument.createRange();
  return Array.from(el.childNodes).some((n) => {
    if (n.nodeType !== Node.TEXT_NODE || (n.textContent ?? '').trim() === '') return false;
    range.selectNodeContents(n);
    return Array.from(range.getClientRects()).some((r) => inside(r, client));
  });
}

/**
 * The color under a client point inside `within`: the text's `color` where text is drawn there, else the
 * `background-color` of the first opaque box from the topmost element up to `within`. Null over nothing, or where
 * no box up to `within` is opaque. The element is found by hit-testing rather than `caretPositionFromPoint`, which
 * answers only for the topmost layer and so cannot see a story under a lens.
 */
export function colorAt(client: LoupePoint, within: HTMLElement): ColorAt | null {
  const el = topmostIn(within, client);
  if (!el) return null;
  if (textUnder(el, client)) return { element: el, property: 'color', value: getComputedStyle(el).color };
  const bg = backgroundOf(el, within);
  if (bg === null) return null;
  if ('unreadable' in bg) return { element: el, property: 'background-color', value: bg.unreadable };
  return { element: bg.element, property: 'background-color', value: bg.color };
}

const STYLE_RULE = 1;
/** Longhands a chain is asked about, and the shorthands that can declare them: a shorthand holding a `var()` leaves its longhands empty in the CSSOM. */
const SHORTHANDS: Readonly<Record<string, readonly string[]>> = { 'background-color': ['background'] };
const INHERITED = (property: string) => property.startsWith('--') || property === 'color';

interface Rule {
  readonly selector: string;
  readonly style: CSSStyleDeclaration;
}

/** Whether a grouping rule's condition holds where `doc` is shown. `@container` and `@layer` are taken as holding. */
function applies(rule: CSSRule, doc: Document): boolean {
  const media = (rule as CSSRule & { media?: MediaList }).media;
  if (media && media.mediaText && doc.defaultView && !doc.defaultView.matchMedia(media.mediaText).matches) return false;
  if (typeof CSSSupportsRule !== 'undefined' && rule instanceof CSSSupportsRule) return CSS.supports(rule.conditionText);
  return true;
}

/** A nested rule's selector made whole: `&` is its parent's, and a selector without one is a descendant of it. */
function nest(selector: string, parent: string | undefined): string {
  if (parent === undefined) return selector;
  return splitTopLevel(selector, ',')
    .map((s) => (s.includes('&') ? s.replaceAll('&', `:is(${parent})`) : `:is(${parent}) ${s.trim()}`))
    .join(', ');
}

function collect(rules: CSSRuleList, doc: Document, into: Rule[], parent?: string): void {
  for (const rule of Array.from(rules)) {
    if (!applies(rule, doc)) continue;
    const imported = (rule as CSSRule & { styleSheet?: CSSStyleSheet | null }).styleSheet;
    if (imported) {
      const inner = cssRulesOf(imported);
      if (inner) collect(inner, doc, into);
      continue;
    }
    const children = (rule as CSSRule & { cssRules?: CSSRuleList }).cssRules;
    if (rule.type !== STYLE_RULE) {
      if (children) collect(children, doc, into, parent);
      continue;
    }
    const style = rule as CSSStyleRule;
    const selector = nest(style.selectorText, parent);
    into.push({ selector, style: style.style });
    if (children) collect(children, doc, into, selector);
  }
}

/** Every style rule `doc` applies, in source order: its sheets, then its adopted sheets, which come after them all. */
function rulesOf(doc: Document): Rule[] {
  const out: Rule[] = [];
  for (const sheet of [...Array.from(doc.styleSheets), ...(doc.adoptedStyleSheets ?? [])]) {
    if (sheet.disabled) continue;
    const rules = cssRulesOf(sheet);
    if (rules) collect(rules, doc, out);
  }
  return out;
}

/** The specificity of the most specific selector in `list` that `el` matches, or null when none does. */
function matching(el: Element, list: string): Specificity | null {
  let best: Specificity | null = null;
  for (const one of splitTopLevel(list, ',')) {
    let hit = false;
    try {
      hit = el.matches(one);
    } catch {
      // A pseudo-element, or a selector this engine cannot query, matches no element.
    }
    const s = hit ? specificity(one.trim()) : null;
    if (s && (best === null || compareSpecificity(s, best) > 0)) best = s;
  }
  return best;
}

function declaredIn(style: CSSStyleDeclaration, property: string): { value: string; important: boolean } | null {
  for (const name of [property, ...(SHORTHANDS[property] ?? [])]) {
    const value = style.getPropertyValue(name).trim();
    if (value) return { value, important: style.getPropertyPriority(name) === 'important' };
  }
  return null;
}

/** A rule's declaration of one property. */
interface Declared {
  readonly selector: string;
  readonly value: string;
  readonly important: boolean;
}

/** The rules declaring each property asked about, read from `rules` once per property. */
function indexOf(rules: readonly Rule[]): (property: string) => readonly Declared[] {
  const index = new Map<string, Declared[]>();
  return (property) => {
    let got = index.get(property);
    if (!got) {
      got = rules.flatMap((r) => {
        const d = declaredIn(r.style, property);
        return d ? [{ selector: r.selector, ...d }] : [];
      });
      index.set(property, got);
    }
    return got;
  };
}

/**
 * The declaration of `property` that wins on `el` itself: important above normal, inline style above every rule of
 * the same importance, then the highest specificity, then the last in source order. Layer order is not modeled.
 */
function winning(el: Element, property: string, rules: readonly Declared[]): ChainLink | null {
  let best: { value: string; important: boolean; spec: Specificity; selector: string } | null = null;
  for (const got of rules) {
    const spec = matching(el, got.selector);
    if (!spec) continue;
    const wins =
      best === null ||
      (got.important && !best.important) ||
      (got.important === best.important && compareSpecificity(spec, best.spec) >= 0);
    if (wins) best = { ...got, spec };
  }
  const inline = (el as Element & { style?: CSSStyleDeclaration }).style;
  const own = inline ? declaredIn(inline, property) : null;
  if (own && (best === null || own.important || !best.important)) return { property, declared: own.value, selector: INLINE, element: el };
  return best ? { property, declared: best.value, selector: best.selector, element: el } : null;
}

/** The winning declaration of `property` on `el`, or, for an inherited property, on its nearest ancestor that has one. */
function declarationOf(el: Element, property: string, rules: readonly Declared[]): ChainLink | null {
  for (let at: Element | null = el; at; at = INHERITED(property) ? at.parentElement : null) {
    const link = winning(at, property, rules);
    if (link) return link;
  }
  return null;
}

/** How often each document's head has changed: a sheet added or removed, or a `<style>` rewritten, as a forge
 *  override or a vite CSS update does. */
const revisions = new WeakMap<Document, { n: number; observer: MutationObserver | null }>();

function revisionOf(doc: Document): number {
  let r = revisions.get(doc);
  if (!r) {
    const made = { n: 0, observer: null as MutationObserver | null };
    if (typeof MutationObserver !== 'undefined' && doc.head) {
      made.observer = new MutationObserver(() => {
        made.n += 1;
      });
      made.observer.observe(doc.head, { childList: true, subtree: true, characterData: true, attributes: true });
    }
    revisions.set(doc, made);
    r = made;
  }
  // Records not yet delivered count now, so a change made in this same task is not missed.
  if ((r.observer?.takeRecords().length ?? 0) > 0) r.n += 1;
  return r.n;
}

const chains = new WeakMap<Element, Map<string, { key: string; chain: readonly ChainLink[] }>>();

/**
 * How a color came to be: the declaration that sets its property, then, for each `var()` that names, the winning
 * declaration of that custom property on the element or its nearest ancestor declaring it, until a value names no
 * `var()`. A forge override is a rule like any other. User-agent styles are not modeled: where the user agent sets
 * an element's own color, as for a link or a button, an inherited property's chain is that of the nearest ancestor
 * an author rule declares it on, and empty when none does. Reused while the element's computed value and the
 * document's stylesheets stand as they were.
 */
export function tokenChain(at: ColorAt): readonly ChainLink[] {
  const doc = at.element.ownerDocument;
  const key = `${at.value}|${revisionOf(doc)}|${doc.styleSheets.length}|${doc.adoptedStyleSheets?.length ?? 0}`;
  let byProperty = chains.get(at.element);
  const held = byProperty?.get(at.property);
  if (held?.key === key) return held.chain;
  const chain = chainOf(at);
  if (!byProperty) {
    byProperty = new Map();
    chains.set(at.element, byProperty);
  }
  byProperty.set(at.property, { key, chain });
  return chain;
}

function chainOf(at: ColorAt): readonly ChainLink[] {
  const declaring = indexOf(rulesOf(at.element.ownerDocument));
  const chain: ChainLink[] = [];
  const seen = new Set<string>();
  const follow = (el: Element, property: string) => {
    if (seen.has(property)) return;
    seen.add(property);
    const link = declarationOf(el, property, declaring(property));
    if (!link) return;
    chain.push(link);
    for (const name of varRefs(link.declared)) follow(link.element, name);
  };
  follow(at.element, at.property);
  return chain;
}
