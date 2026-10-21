const VAR_REF = /var\(\s*(--[\w-]+)/g;
const CUSTOM_DECL = /(?:^|[;{\s])(--[\w-]+)\s*:\s*([^;]*)/g;
// A selector naming a pseudo-element, or a state the pointer or focus has to be in, matches no element at rest.
const RESTLESS = /::?(?:before|after|first-line|first-letter|marker|placeholder|selection|backdrop|file-selector-button)\b|::[\w-]+(?:\([^)]*\))?|:(?:hover|active|focus-visible|focus-within|focus|visited|target)\b/g;
const STYLE_RULE = 1;

/** Every custom property `text` reads with `var()`. */
export function varRefs(text: string, into: Set<string> = new Set()): Set<string> {
  if (!text.includes('var(')) return into;
  for (const [, name] of text.matchAll(VAR_REF)) into.add(name!);
  return into;
}

/** Where a selector lands relative to the story: on it or inside it, or on an ancestor whose declarations it inherits. */
interface Reach {
  readonly within: boolean;
  readonly above: boolean;
}

function reach(selector: string, root: Element): Reach {
  const resting = selector.replace(RESTLESS, '').trim() || '*';
  try {
    return { within: root.matches(resting) || root.querySelector(resting) !== null, above: root.parentElement?.closest(resting) != null };
  } catch {
    // A selector the engine can't query is kept rather than lost.
    return { within: true, above: true };
  }
}

/** A declaration block split into what it defines and the custom properties its other declarations read. */
function readBlock(block: string, defs: Map<string, Set<string>>, seeds: Set<string> | null): void {
  for (const [, name, value] of block.matchAll(CUSTOM_DECL)) {
    const refs = defs.get(name!) ?? new Set<string>();
    varRefs(value!, refs);
    defs.set(name!, refs);
  }
  if (seeds) varRefs(block.replace(CUSTOM_DECL, ''), seeds);
}

function blockOf(rule: CSSRule): string {
  const text = rule.cssText;
  const open = text.indexOf('{');
  return open < 0 ? '' : text.slice(open + 1, text.lastIndexOf('}'));
}

function walk(rules: CSSRuleList, root: Element, defs: Map<string, Set<string>>, seeds: Set<string>, parent?: Reach): void {
  for (const rule of Array.from(rules)) {
    const imported = (rule as CSSRule & { styleSheet?: CSSStyleSheet | null }).styleSheet;
    if (imported) {
      const inner = cssRulesOf(imported);
      if (inner) walk(inner, root, defs, seeds);
      continue;
    }
    const children = (rule as CSSRule & { cssRules?: CSSRuleList }).cssRules;
    if (rule.type !== STYLE_RULE) {
      // @media, @supports, @layer and @container hold rules; a keyframe or a font face reaches no element.
      if (children) walk(children, root, defs, seeds, parent);
      continue;
    }
    // A nested rule's selector is relative to its parent's, so it inherits the parent's reach.
    const at = parent ?? reach((rule as CSSStyleRule).selectorText, root);
    if (at.within || at.above) readBlock(blockOf(rule), defs, at.within ? seeds : null);
  }
}

export function cssRulesOf(sheet: CSSStyleSheet): CSSRuleList | null {
  try {
    return sheet.cssRules;
  } catch {
    // A cross-origin sheet refuses to be read.
    return null;
  }
}

/**
 * The custom properties the story under `root` uses: those read by a declaration of a rule matching an element in
 * it, or by its inline styles, and every property one of those reads in turn through a definition that reaches it.
 * A definition on an ancestor reaches it by inheritance; an ancestor's other declarations do not count as use.
 */
export function usedCssVars(doc: Document, root: Element): Set<string> {
  const defs = new Map<string, Set<string>>();
  const seeds = new Set<string>();
  for (const sheet of Array.from(doc.styleSheets)) {
    const rules = cssRulesOf(sheet);
    if (rules) walk(rules, root, defs, seeds);
  }
  for (const el of Array.from(doc.querySelectorAll('[style]'))) {
    const within = root.contains(el);
    if (within || el.contains(root)) readBlock(el.getAttribute('style') ?? '', defs, within ? seeds : null);
  }

  const used = new Set<string>();
  const queue = [...seeds];
  while (queue.length > 0) {
    const name = queue.pop()!;
    if (used.has(name)) continue;
    used.add(name);
    for (const ref of defs.get(name) ?? []) queue.push(ref);
  }
  return used;
}
