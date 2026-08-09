import { resolveTheme } from './resolveTheme';
import type { Theme } from './theme';

const STYLE_ID = 'wzl-themes';
const emitted = new Set<string>();
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

function appendRule(css: string): void {
  if (canAdopt()) {
    if (!sheet) {
      sheet = new CSSStyleSheet();
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    }
    sheet.insertRule(css, sheet.cssRules.length);
    return;
  }
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent += `${css}\n`;
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
  if (!emitted.has(key)) {
    const resolved = resolveTheme(theme, mode);
    const body = Object.entries(resolved)
      .map(([name, value]) => `${name}: ${value};`)
      .join(' ');
    appendRule(`[data-wzl-theme='${theme.name}'][data-wzl-mode='${mode}'] { ${body} }`);
    emitted.add(key);
  }

  el.setAttribute('data-wzl-theme', theme.name);
  el.setAttribute('data-wzl-mode', mode);
}
