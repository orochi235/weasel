import type { CssVarReport } from '../protocol/messages';

const VAR_REF = /var\(\s*(--[\w-]+)/g;

function collect(text: string, names: Set<string>): void {
  if (!text.includes('var(')) return;
  for (const [, name] of text.matchAll(VAR_REF)) names.add(name!);
}

/** A grouping rule's text holds its children's; an `@import` holds only its URL, so its sheet is read too. */
function walkRules(sheet: CSSStyleSheet, names: Set<string>): void {
  let rules: CSSRuleList;
  try {
    rules = sheet.cssRules;
  } catch {
    // A cross-origin sheet refuses to be read.
    return;
  }
  for (const rule of Array.from(rules)) {
    const imported = (rule as CSSRule & { styleSheet?: CSSStyleSheet | null }).styleSheet;
    if (imported) walkRules(imported, names);
    else collect(rule.cssText, names);
  }
}

/**
 * Every custom property the document references with `var()`, from inline styles and stylesheet rules — computed
 * styles have already substituted the reference away. Values resolve on `:root`, or else on the first element that
 * declares one.
 */
export function scanCssVars(doc: Document, overridden: (name: string) => boolean = () => false): CssVarReport[] {
  const names = new Set<string>();
  for (const el of Array.from(doc.querySelectorAll('[style]'))) collect(el.getAttribute('style') ?? '', names);
  for (const sheet of Array.from(doc.styleSheets)) walkRules(sheet, names);

  const values = resolveValues(doc, names);
  return [...names]
    .sort()
    .map((name) => ({ name, value: values.get(name) ?? '', overridden: overridden(name) }));
}

function resolveValues(doc: Document, names: Iterable<string>): Map<string, string> {
  const view = doc.defaultView;
  const values = new Map<string, string>();
  if (!view) return values;
  const root = view.getComputedStyle(doc.documentElement);
  const missing: string[] = [];
  for (const name of names) {
    const value = root.getPropertyValue(name).trim();
    if (value) values.set(name, value);
    else missing.push(name);
  }
  for (const el of missing.length > 0 ? Array.from((doc.body ?? doc.documentElement).querySelectorAll('*')) : []) {
    const style = view.getComputedStyle(el);
    for (let i = missing.length - 1; i >= 0; i--) {
      const value = style.getPropertyValue(missing[i]!).trim();
      if (!value) continue;
      values.set(missing[i]!, value);
      missing.splice(i, 1);
    }
    if (missing.length === 0) break;
  }
  return values;
}

/** One custom property's value, resolved the way `scanCssVars` resolves each. */
export function resolveCssVar(doc: Document, name: string): string {
  return resolveValues(doc, [name]).get(name) ?? '';
}

export interface Overrides {
  set(name: string, value: string | null): void;
  has(name: string): boolean;
  /** Whether `node` is the override style element or inside it. */
  owns(node: Node): boolean;
  dispose(): void;
}

/**
 * Custom property overrides as one rule on `scope`, kept last in `<head>`. `:not(#fg-overrides)` adds an ID's weight
 * without `!important`, so the rule outranks a theme's attribute selectors; a stylesheet that lands after it sends
 * the element back to the end.
 */
export function createOverrides(doc: Document, scope = ':root'): Overrides {
  const values = new Map<string, string>();
  const style = doc.createElement('style');
  style.setAttribute('data-fg-overrides', '');

  // Another instance's style counts as last place too, or two instances would take turns moving forever.
  const keepLast = () => {
    if (style.parentNode === doc.head) {
      let next = style.nextElementSibling;
      while (next?.hasAttribute('data-fg-overrides')) next = next.nextElementSibling;
      if (next === null) return;
    }
    doc.head.append(style);
  };
  const write = () => {
    const decls = [...values].map(([name, value]) => `  ${name}: ${value};`);
    style.textContent = decls.length > 0 ? `:is(${scope}):not(#fg-overrides) {\n${decls.join('\n')}\n}\n` : '';
  };

  keepLast();
  const observer = typeof MutationObserver === 'undefined' ? null : new MutationObserver(keepLast);
  observer?.observe(doc.head, { childList: true });

  return {
    set(name, value) {
      if (value === null) values.delete(name);
      else values.set(name, value);
      write();
    },
    has: (name) => values.has(name),
    owns: (node) => style.contains(node),
    dispose() {
      observer?.disconnect();
      style.remove();
    },
  };
}
