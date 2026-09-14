const VAR = /var\(\s*--wzl-([\w-]+)/g;
const CUSTOM_DECLARATION = /--[\w-]+\s*:[^;]*;?/g;

function matches(el: Element, selector: string): boolean {
  try {
    return el.matches(selector);
  } catch {
    // A nested rule's `&` selector, or one the engine can't parse outside its context.
    return false;
  }
}

/**
 * Every `--wzl-*` token read by a stylesheet rule matching `target` or an element between it and `root` (exclusive), in
 * the order the rules appear. Custom property declarations are skipped: those define tokens, like the theme's own rules.
 */
export function tokensReadAt(target: Element, root: Element, sheets: Iterable<CSSStyleSheet>): string[] {
  const chain: Element[] = [];
  for (let el: Element | null = target; el && el !== root; el = el.parentElement) chain.push(el);
  const names = new Set<string>();
  const visit = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSStyleRule && chain.some((el) => matches(el, rule.selectorText))) {
        for (const m of rule.style.cssText.replace(CUSTOM_DECLARATION, '').matchAll(VAR)) names.add(m[1]);
      }
      const nested = (rule as Partial<CSSGroupingRule>).cssRules;
      if (nested) visit(nested);
    }
  };
  for (const sheet of sheets) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      // A cross-origin sheet refuses to be read.
      continue;
    }
    visit(rules);
  }
  return [...names];
}

export function documentSheets(doc: Document = document): CSSStyleSheet[] {
  return [...Array.from(doc.styleSheets), ...(doc.adoptedStyleSheets ?? [])];
}
