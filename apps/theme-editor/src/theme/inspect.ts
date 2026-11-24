import { compareSpecificity, specificity, splitTopLevel, type Specificity } from '@weasel-js/svg';

const VAR = /var\(\s*--([\w-]+)/g;
const STRING = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g;
const IMPORTANT = /!\s*important\s*$/i;
const TOKEN = 'wzl-';

function matches(el: Element, selector: string): boolean {
  try {
    return el.matches(selector);
  } catch {
    // A nested rule's `&` selector, or one the engine can't parse outside its context.
    return false;
  }
}

interface Declaration {
  readonly prop: string;
  readonly value: string;
  readonly important: boolean;
}

function declarationsOf(cssText: string): Declaration[] {
  return splitTopLevel(cssText, ';').flatMap((part) => {
    const colon = part.indexOf(':');
    if (colon < 0) return [];
    const value = part.slice(colon + 1);
    const important = IMPORTANT.test(value);
    return [{ prop: part.slice(0, colon).trim(), value: important ? value.replace(IMPORTANT, '') : value, important }];
  });
}

/** The specificity `rule` applies to `el` with: its most specific selector that `el` matches, or null when none does. */
function specificityAt(el: Element, selectorText: string): Specificity | null {
  let best: Specificity | null = null;
  for (const selector of splitTopLevel(selectorText, ',')) {
    if (!matches(el, selector)) continue;
    const s = specificity(selector.trim());
    if (best === null || compareSpecificity(s, best) > 0) best = s;
  }
  return best;
}

interface Winner {
  readonly value: string;
  readonly important: boolean;
  readonly specificity: Specificity;
  readonly order: number;
}

const beats = (a: Winner, b: Winner): boolean =>
  a.important !== b.important ? a.important : compareSpecificity(a.specificity, b.specificity) > 0 || (compareSpecificity(a.specificity, b.specificity) === 0 && a.order > b.order);

const varsIn = (value: string): string[] => Array.from(value.replace(STRING, '').matchAll(VAR), (m) => m[1]);

/**
 * Every `--wzl-*` token read by a stylesheet declaration in force on `target` or an element between it and `root` (exclusive), in
 * the order the rules appear. Only the declaration the cascade picks for each element and property counts. A custom property
 * counts only through a property that reads it, as a component's `--btn-radius: var(--wzl-button-radius)` does through
 * `border-radius: var(--btn-radius)`, and holds what its nearest declaration on that element or an ancestor gives it.
 */
export function tokensReadAt(target: Element, root: Element, sheets: Iterable<CSSStyleSheet>): string[] {
  const chain: Element[] = [];
  for (let el: Element | null = target; el && el !== root; el = el.parentElement) chain.push(el);
  const winners = chain.map(() => new Map<string, Winner>());
  let order = 0;
  // A media or supports rule the page does not meet adds nothing; one this environment cannot test counts.
  const view = target.ownerDocument.defaultView;
  const applies = (rule: CSSRule): boolean => {
    if (rule instanceof CSSMediaRule) return view?.matchMedia?.(rule.media.mediaText).matches ?? true;
    if (typeof CSSSupportsRule !== 'undefined' && rule instanceof CSSSupportsRule) return view?.CSS?.supports?.(rule.conditionText) ?? true;
    return true;
  };
  const visit = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSStyleRule) {
        const declarations = declarationsOf(rule.style.cssText);
        chain.forEach((el, i) => {
          const at = specificityAt(el, rule.selectorText);
          if (at === null) return;
          for (const { prop, value, important } of declarations) {
            const next: Winner = { value, important, specificity: at, order: order++ };
            const held = winners[i].get(prop);
            if (!held || beats(next, held)) winners[i].set(prop, next);
          }
        });
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
  const names = new Set<string>();
  const follow = (name: string, from: number) => {
    if (name.startsWith(TOKEN)) names.add(name.slice(TOKEN.length));
    const at = winners.findIndex((w, i) => i >= from && w.has(`--${name}`));
    if (at < 0 || seen.has(`${at}:${name}`)) return;
    seen.add(`${at}:${name}`);
    for (const next of varsIn(winners[at].get(`--${name}`)!.value)) follow(next, at);
  };
  const reads = winners
    .flatMap((w, i) => [...w].filter(([prop]) => !prop.startsWith('--')).map(([, winner]) => ({ winner, i })))
    .sort((a, b) => a.winner.order - b.winner.order);
  for (const { winner, i } of reads) for (const name of varsIn(winner.value)) follow(name, i);
  return [...names];
}

export function documentSheets(doc: Document = document): CSSStyleSheet[] {
  return [...Array.from(doc.styleSheets), ...(doc.adoptedStyleSheets ?? [])];
}
