import { splitTopLevel } from '@weasel-js/svg';

const VAR = /var\(\s*--([\w-]+)/g;
const STRING = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g;
const TOKEN = 'wzl-';

function matches(el: Element, selector: string): boolean {
  try {
    return el.matches(selector);
  } catch {
    // A nested rule's `&` selector, or one the engine can't parse outside its context.
    return false;
  }
}

function declarationsOf(cssText: string): { prop: string; value: string }[] {
  return splitTopLevel(cssText, ';').flatMap((part) => {
    const colon = part.indexOf(':');
    return colon < 0 ? [] : [{ prop: part.slice(0, colon).trim(), value: part.slice(colon + 1) }];
  });
}

/**
 * Every `--wzl-*` token read by a stylesheet rule in force matching `target` or an element between it and `root` (exclusive), in
 * the order the rules appear. A custom property declaration counts only through a property that reads it, as a component's
 * `--btn-radius: var(--wzl-button-radius)` does through `border-radius: var(--btn-radius)`; one nothing reads adds nothing.
 */
export function tokensReadAt(target: Element, root: Element, sheets: Iterable<CSSStyleSheet>): string[] {
  const chain: Element[] = [];
  for (let el: Element | null = target; el && el !== root; el = el.parentElement) chain.push(el);
  const reads: string[] = [];
  const holds = new Map<string, string[]>();
  // A media or supports rule the page does not meet adds nothing; one this environment cannot test counts.
  const view = target.ownerDocument.defaultView;
  const applies = (rule: CSSRule): boolean => {
    if (rule instanceof CSSMediaRule) return view?.matchMedia?.(rule.media.mediaText).matches ?? true;
    if (typeof CSSSupportsRule !== 'undefined' && rule instanceof CSSSupportsRule) return view?.CSS?.supports?.(rule.conditionText) ?? true;
    return true;
  };
  const visit = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSStyleRule && chain.some((el) => matches(el, rule.selectorText))) {
        for (const { prop, value } of declarationsOf(rule.style.cssText)) {
          const read = Array.from(value.replace(STRING, '').matchAll(VAR), (m) => m[1]);
          if (!prop.startsWith('--')) reads.push(...read);
          else if (read.length > 0) holds.set(prop.slice(2), [...(holds.get(prop.slice(2)) ?? []), ...read]);
        }
      }
      const nested = (rule as Partial<CSSGroupingRule>).cssRules;
      if (nested && applies(rule)) visit(nested);
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
  const seen = new Set<string>();
  const names: string[] = [];
  const follow = (name: string) => {
    if (seen.has(name)) return;
    seen.add(name);
    if (name.startsWith(TOKEN)) names.push(name.slice(TOKEN.length));
    for (const next of holds.get(name) ?? []) follow(next);
  };
  for (const name of reads) follow(name);
  return names;
}

export function documentSheets(doc: Document = document): CSSStyleSheet[] {
  return [...Array.from(doc.styleSheets), ...(doc.adoptedStyleSheets ?? [])];
}
