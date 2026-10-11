import { fullSelection, type Selection } from './axes';
import { resolveTheme, themeAxes } from './resolveTheme';
import type { Theme } from './theme';
import { holdRule, styleRootOf } from './themeSheet';

export { __resetThemeSheet } from './themeSheet';

/** What an element holds from its last `applyTheme`, so the next one, or its release, can let go of it. */
const holds = new WeakMap<HTMLElement, () => void>();

/**
 * Apply `theme` at `selection` to `el`'s subtree, and return the release.
 *
 * Stamps `data-wzl-theme` and one `data-wzl-<axis>` per axis, and holds a
 * matching rule block in the stylesheet of the document or shadow root `el`
 * lives in. Deliberately not inline properties: the cascade then does the
 * work, per-subtree overrides are just a different theme name, and no
 * `!important` is ever needed. No-op outside a DOM.
 *
 * An element holds one application: applying again replaces what it held, so
 * a caller restyling one root never has to release. The release is for a
 * subtree that goes away. It takes the attributes back off and lets go of the
 * rule, which leaves the sheet once no element holds it; a release whose
 * element has since been given something else does nothing.
 *
 * Two different themes may share a name. The second held at once has its rule
 * kept to its own elements by a `data-wzl-variant` attribute, matched inside
 * `:where()` so the rule's specificity is the first's.
 */
export function applyTheme(el: HTMLElement, theme: Theme, selection: Selection = {}): () => void {
  if (typeof document === 'undefined') return () => {};

  const axes = themeAxes(theme);
  const sel = fullSelection(axes, selection);
  const body = Object.entries(resolveTheme(theme, sel))
    .map(([name, value]) => `${name}: ${value};`)
    .join(' ');
  const names = Object.keys(axes);
  const selector = `[data-wzl-theme='${theme.name}']${names.map((a) => `[data-wzl-${a}='${sel[a]}']`).join('')}`;
  // Held before the last one is let go, so re-applying the same rule rewrites nothing.
  const { variant, release: releaseRule } = holdRule(styleRootOf(el), selector, body);
  holds.get(el)?.();

  el.setAttribute('data-wzl-theme', theme.name);
  for (const a of names) el.setAttribute(`data-wzl-${a}`, sel[a]);
  if (variant === 0) el.removeAttribute('data-wzl-variant');
  else el.setAttribute('data-wzl-variant', String(variant));

  // The attributes go only through `release`: a hold replaced by the next application leaves them to it.
  const letGo = (): void => {
    holds.delete(el);
    releaseRule();
  };
  holds.set(el, letGo);
  return () => {
    if (holds.get(el) !== letGo) return;
    letGo();
    for (const a of ['theme', 'variant', ...names]) el.removeAttribute(`data-wzl-${a}`);
  };
}
