import { fullSelection, selectionKey, type Selection } from './axes';
import { resolveTheme, themeAxes } from './resolveTheme';
import type { Theme } from './theme';

const STYLE_ID = 'wzl-themes';
/** `theme.name::selection key` → the rule text currently published for it. Keyed by
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
 * Apply `theme` at `selection` to `el`'s subtree.
 *
 * Stamps `data-wzl-theme` and one `data-wzl-<axis>` per axis, and ensures a
 * matching rule block exists in a module-owned stylesheet. Deliberately not
 * inline properties: the cascade then does the work, per-subtree overrides are
 * just a different theme name, and no `!important` is ever needed. No-op
 * outside a DOM.
 */
export function applyTheme(el: HTMLElement, theme: Theme, selection: Selection = {}): void {
  if (typeof document === 'undefined') return;

  const axes = themeAxes(theme);
  const sel = fullSelection(axes, selection);
  const key = `${theme.name}::${selectionKey(axes, sel)}`;
  const body = Object.entries(resolveTheme(theme, sel))
    .map(([name, value]) => `${name}: ${value};`)
    .join(' ');
  const attrs = Object.keys(axes).map((a) => `[data-wzl-${a}='${sel[a]}']`).join('');
  const rule = `[data-wzl-theme='${theme.name}']${attrs} { ${body} }`;
  if (emitted.get(key) !== rule) {
    emitted.set(key, rule);
    flushRules();
  }

  el.setAttribute('data-wzl-theme', theme.name);
  for (const a of Object.keys(axes)) el.setAttribute(`data-wzl-${a}`, sel[a]);
}
