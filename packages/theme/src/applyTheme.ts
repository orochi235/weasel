import { axisScheme, fullSelection, wzlAttr, wzlValue, type AxisDefs, type Selection } from './axes';
import { blendTheme, type AxisWeights } from './blendTheme';
import { resolveTheme, themeAxes } from './resolveTheme';
import type { Theme } from './theme';
import { holdRule, styleRootOf } from './themeSheet';
import { warnThemeOnce } from './warnOnce';
import { getOwn } from '@weasel-js/registry';

export { __resetThemeSheet } from './themeSheet';

/**
 * Whether `value` can stand as a declaration's value: no `;`, `{`, `}` or comment opener outside a
 * quoted string, no line break inside one (CSS ends the string there), no quote or bracket left
 * open (an open `(` or `[` runs on through every later rule), no `)` or `]` closing nothing (a
 * custom property holding one is invalid, so the declaration drops), and no backslash escaping
 * the declaration's own `;`.
 */
function declarable(value: string): boolean {
  let quote: string | null = null;
  const open: string[] = [];
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === '\\') {
      if (++i === value.length) return false;
    } else if (quote !== null) {
      if (c === quote) quote = null;
      else if (c === '\n' || c === '\r' || c === '\f') return false;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === ';' || c === '{' || c === '}' || (c === '/' && value[i + 1] === '*')) return false;
    else if (c === '(') open.push(')');
    else if (c === '[') open.push(']');
    else if (c === ')' || c === ']') {
      if (open.pop() !== c) return false;
    }
  }
  return quote === null && open.length === 0;
}

/** The declarations of `tokens`, less any whose value would end its declaration or rule. */
function declarations(theme: Theme, tokens: Readonly<Record<string, string>>): string[] {
  return Object.entries(tokens).flatMap(([name, value]) => {
    if (declarable(value)) return [`${name}: ${value};`];
    warnThemeOnce(`value\0${theme.name}\0${name}\0${value}`, `applyTheme: theme "${theme.name}" leaves out ${name}, whose value "${value}" would end its rule.`);
    return [];
  });
}

/** Warns, once each, of a selection axis `theme` does not declare (unless `ignoreUnknownAxes`) and of a value its axis lacks. */
function warnUnknownSelection(theme: Theme, axes: AxisDefs, selection: Selection, ignoreUnknownAxes: boolean): void {
  for (const [axis, value] of Object.entries(selection)) {
    const def = getOwn(axes, axis);
    if (!def) {
      if (ignoreUnknownAxes) continue;
      warnThemeOnce(
        `axis-name\0${theme.name}\0${axis}`,
        `applyTheme: theme "${theme.name}" declares no axis "${axis}", so it is ignored. Its axes: ${Object.keys(axes).join(', ') || 'none'}. Pass \`ignoreUnknownAxes\` where one selection is shared across themes on purpose.`,
      );
    } else if (!Object.hasOwn(def.values, value)) {
      warnThemeOnce(
        `axis\0${theme.name}\0${axis}\0${value}`,
        `applyTheme: theme "${theme.name}" has no ${axis} "${value}"; using "${def.default}". Its ${axis} values: ${Object.keys(def.values).join(', ')}.`,
      );
    }
  }
}

/** What an element holds from its last `applyTheme`, so the next one, or its release, can let go of it. */
const holds = new WeakMap<HTMLElement, { readonly letGo: () => void; readonly axes: readonly string[] }>();

/** Options for `applyTheme`. */
export interface ApplyThemeOptions {
  /** Blend the theme along the axes these name; see `blendTheme`. */
  weights?: AxisWeights;
  /** Leave unwarned a selection axis the theme does not declare: for one selection shared across themes on purpose. */
  ignoreUnknownAxes?: boolean;
}

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
 * With `weights`, the rule holds the theme blended along the axes they name
 * (see `blendTheme`), under the same attributes: applying again with the next
 * weights is one step of a transition between two selections.
 *
 * Two different themes may share a name. The second held at once has its rule
 * kept to its own elements by a `data-wzl-variant` attribute, matched inside
 * `:where()` so the rule's specificity is the first's.
 *
 * In development it warns, once each, of a selection axis the theme does not
 * declare and of an axis value the theme lacks, which takes the axis default.
 */
export function applyTheme(el: HTMLElement, theme: Theme, selection: Selection = {}, options: ApplyThemeOptions = {}): () => void {
  if (typeof document === 'undefined') return () => {};

  const axes = themeAxes(theme);
  warnUnknownSelection(theme, axes, selection, options.ignoreUnknownAxes ?? false);
  const sel = fullSelection(axes, selection);
  const picked = Object.entries(sel);
  const names = picked.map(([a]) => a);
  const scheme = picked.map(([a, v]) => axisScheme(axes, a, v)).find((s) => s !== undefined);
  const body = [
    ...(scheme ? [`color-scheme: ${scheme};`] : []),
    ...declarations(theme, options.weights ? blendTheme(theme, options.weights, sel) : resolveTheme(theme, sel)),
  ].join(' ');
  const selector = `${wzlAttr('theme', theme.name)}${picked.map(([a, v]) => wzlAttr(a, v)).join('')}`;
  // Held before the last one is let go, so re-applying the same rule rewrites nothing.
  const { variant, release: releaseRule } = holdRule(styleRootOf(el), selector, body);
  const prior = holds.get(el);
  prior?.letGo();
  // An axis the last application stamped and this one has not would still match that theme's rules.
  for (const a of prior?.axes ?? []) if (!names.includes(a)) el.removeAttribute(`data-wzl-${a}`);

  el.setAttribute('data-wzl-theme', wzlValue(theme.name));
  for (const [a, v] of picked) el.setAttribute(`data-wzl-${a}`, wzlValue(v));
  if (variant === 0) el.removeAttribute('data-wzl-variant');
  else el.setAttribute('data-wzl-variant', String(variant));

  // The attributes go only through `release`: a hold replaced by the next application leaves them to it.
  const letGo = (): void => {
    holds.delete(el);
    releaseRule();
  };
  holds.set(el, { letGo, axes: names });
  return () => {
    if (holds.get(el)?.letGo !== letGo) return;
    letGo();
    for (const a of ['theme', 'variant', ...names]) el.removeAttribute(`data-wzl-${a}`);
  };
}
