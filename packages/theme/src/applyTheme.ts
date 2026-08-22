import { resolveTheme } from './resolveTheme';
import type { Theme } from './theme';

const STYLE_ID = 'wzl-themes';
/** `theme.name::mode` → the rule text currently published for it. Keyed by
 *  name because that is what the rule's selector matches on, and holding the
 *  text is what lets a redefinition under the same name replace its rule
 *  rather than be swallowed as a cache hit. */
const emitted = new Map<string, string>();
let sheet: CSSStyleSheet | null = null;
let styleEl: HTMLStyleElement | null = null;

/** Test seam — drops the module-level cache so each case starts clean. */
export function __resetThemeSheet(): void {
  emitted.clear();
  sheet = null;
  styleEl = null;
}

function canAdopt(): boolean {
  return (
    typeof CSSStyleSheet !== 'undefined' &&
    'replaceSync' in CSSStyleSheet.prototype &&
    Array.isArray(document.adoptedStyleSheets)
  );
}

/** Republish every rule from `emitted`. Rewriting the whole sheet rather than
 *  appending keeps it the size of the theme set: a theme redefined under a
 *  name it already used replaces its rule instead of stacking another one. */
function flushRules(): void {
  const css = [...emitted.values()].join('\n');
  if (canAdopt()) {
    if (!sheet) {
      sheet = new CSSStyleSheet();
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    }
    sheet.replaceSync(css);
    return;
  }
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = css;
}

/**
 * Apply `theme` at `mode` to `el`'s subtree.
 *
 * Stamps two data attributes and ensures a matching rule block exists in a
 * module-owned stylesheet. Deliberately not inline properties: the cascade
 * then does the work, per-subtree overrides are just a different theme name,
 * and no `!important` is ever needed. No-op outside a DOM.
 */
export function applyTheme(el: HTMLElement, theme: Theme, mode: string): void {
  if (typeof document === 'undefined') return;

  const key = `${theme.name}::${mode}`;
  const resolved = resolveTheme(theme, mode);
  const body = Object.entries(resolved)
    .map(([name, value]) => `${name}: ${value};`)
    .join(' ');
  const rule = `[data-wzl-theme='${theme.name}'][data-wzl-mode='${mode}'] { ${body} }`;
  if (emitted.get(key) !== rule) {
    emitted.set(key, rule);
    flushRules();
  }

  el.setAttribute('data-wzl-theme', theme.name);
  el.setAttribute('data-wzl-mode', mode);
}
