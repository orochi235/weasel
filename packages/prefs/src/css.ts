// A store's values as CSS custom properties: one block for what every choice
// of the selectors shares, and one for each choice a split value tells apart.

import type { PrefGroup } from './groups';
import { prefHoldsValue, prefLeaves, prefValueAtPath } from './helpers';
import { isPrefLocus, type PrefLocus, type PrefSelection } from './locus';
import type { PrefEnum, PrefLeaf, PrefNumber } from './schema';
import { prefSelectors } from './splitCheck';
import { resolvePrefUnit } from './unit';

/** How {@link prefsCss} names and writes things. */
export interface PrefsCssOptions {
  /** The selector of the element the properties are set on, and the selectors' attributes read from. Default `:root`;
   *  `:host` matches the attributes the way a shadow root's sheet has to, as `:host([…])`. */
  root?: string;
  /** The custom property a leaf is written as, or `null` to leave the leaf out. Default: `--`, then the path with
   *  each `.` and each capital turned into a `-` (`look.gridGap` is `--look-grid-gap`). */
  property?: (path: string, leaf: PrefLeaf) => string | null;
  /** The attribute a selector's option is read from. Default: `data-`, then the path as a property spells it. */
  attribute?: (selector: string) => string;
  /** The CSS text of a value, `null` to leave it out, or `undefined` for what its kind writes by itself. */
  value?: (value: unknown, leaf: PrefLeaf, path: string) => string | null | undefined;
}

/** What {@link prefsCss} reads of a store: any `PrefsStore` is one. */
export interface PrefsCssSource {
  schema: PrefGroup;
  values(read?: { at?: PrefSelection }): Record<string, unknown>;
  locus(path: string): PrefLocus | undefined;
  get(path: string): unknown;
}

/** A path as the default names spell it: `look.gridGap` is `look-grid-gap`. */
export const kebab = (path: string): string => path.replace(/\./g, '-').replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/** The CSS unit a number leaf's suffix names, for the suffixes that name one. */
const CSS_UNITS: Readonly<Record<string, string>> = {
  px: 'px', '%': '%', em: 'em', rem: 'rem', ch: 'ch', pt: 'pt', vw: 'vw', vh: 'vh',
  ms: 'ms', s: 's', '°': 'deg', deg: 'deg', rad: 'rad', turn: 'turn',
};

const IDENT = /^-?[A-Za-z_][\w-]*$/;
const quoted = (text: string): string => `'${text.replace(/[\\']/g, '\\$&')}'`;

/** What a value of a built-in kind is written as, `null` for one with no CSS form. */
function cssValue(leaf: PrefLeaf, value: unknown): string | null {
  switch (leaf.kind) {
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return null;
      const { unit } = leaf as PrefNumber;
      const resolved = unit ? resolvePrefUnit(unit) : undefined;
      const shown = resolved ? resolved.toDisplay(value) : value;
      const suffix = resolved?.suffix !== undefined && Object.hasOwn(CSS_UNITS, resolved.suffix) ? CSS_UNITS[resolved.suffix] : '';
      return `${Number(shown.toFixed(6))}${suffix}`;
    }
    case 'boolean':
      return typeof value === 'boolean' ? (value ? '1' : '0') : null;
    case 'color':
      return typeof value === 'string' && value !== '' ? value : null;
    case 'enum':
      if (typeof value !== 'string' || (leaf as PrefEnum).encoding) return null;
      return IDENT.test(value) ? value : quoted(value);
    case 'string':
      return typeof value === 'string' ? quoted(value) : null;
    default:
      return null;
  }
}

/** One choice of options, a selector's path and its option per step, and the value read under it. */
type Told = { under: [selector: string, option: string][]; value: unknown };

/** Every choice of options a held value tells apart, outermost selector first. */
function toldApart(held: unknown, optionsOf: (selector: string) => readonly string[], absent: unknown): Told[] {
  const out: Told[] = [];
  const walk = (value: unknown, under: Told['under']): void => {
    if (!isPrefLocus(value)) {
      out.push({ under, value });
      return;
    }
    for (const option of optionsOf(value.$by)) {
      walk(Object.hasOwn(value.$of, option) ? value.$of[option] : absent, [...under, [value.$by, option]]);
    }
  };
  walk(held, []);
  return out;
}

/**
 * The store's values as CSS custom properties.
 *
 * The first block sets every leaf on `root`, a split one at the member the
 * selectors' defaults name, so a page that sets no attribute still has a
 * value for each. A block follows for each choice of options some value tells
 * apart, matched by an attribute per selector on that same element; a selector
 * is written under each of its own options too. Every block is inside
 * `:where()`, so none outranks another by how many attributes it names, and a
 * rule of the page's own wins. Blocks naming more selectors come later.
 *
 * A number is written in its display unit where the unit's suffix is a CSS
 * unit, and bare otherwise; a boolean as `1` or `0`; a color as it is held; an
 * enum's option as an identifier; a string quoted. A leaf of any other kind is
 * left out unless `value` writes it.
 */
export function prefsCss(store: PrefsCssSource, options: PrefsCssOptions = {}): string {
  const root = options.root ?? ':root';
  const property = options.property ?? ((path: string): string => `--${kebab(path)}`);
  const attribute = options.attribute ?? ((selector: string): string => `data-${kebab(selector)}`);
  const leaves = new Map([...prefLeaves(store.schema)].filter(([, leaf]) => prefHoldsValue(leaf)));
  const selectors = prefSelectors(leaves);
  const defaults = Object.fromEntries([...selectors.keys()].map((path) => [path, leaves.get(path)!.default as string]));
  const base = store.values({ at: defaults });

  const blocks = new Map<string, { under: Told['under']; lines: string[] }>();
  const declare = (under: Told['under'], path: string, leaf: PrefLeaf, value: unknown): void => {
    const name = property(path, leaf);
    if (name === null) return;
    const given = options.value?.(value, leaf, path);
    const text = given === undefined ? cssValue(leaf, value) : given;
    if (text === null) return;
    const key = under.map(([selector, option]) => `${selector}=${option}`).join('&');
    if (!blocks.has(key)) blocks.set(key, { under, lines: [] });
    blocks.get(key)!.lines.push(`  ${name}: ${text};`);
  };

  for (const [path, leaf] of leaves) {
    declare([], path, leaf, prefValueAtPath(base, path));
    const own = selectors.get(path);
    if (own) for (const option of own) declare([[path, option]], path, leaf, option);
    const held = store.locus(path);
    if (!held) continue;
    for (const { under, value } of toldApart(held, (selector) => selectors.get(selector) ?? [], leaf.default)) {
      declare(under, path, leaf, value);
    }
  }

  return [...blocks.values()]
    .map((block, i) => ({ ...block, i }))
    .sort((a, b) => a.under.length - b.under.length || a.i - b.i)
    .map(({ under, lines }) => {
      const matched = under.map(([selector, option]) => `[${attribute(selector)}=${quoted(option)}]`).join('');
      const at = root === ':host' && matched !== '' ? `:host(${matched})` : `${root}${matched}`;
      return `:where(${at}) {\n${lines.join('\n')}\n}`;
    })
    .join('\n\n');
}

/**
 * The attribute for each selector and the option it is set to: what to set
 * on the `root` element for the blocks of {@link prefsCss} to match the
 * store's own choice.
 */
export function prefsCssAttributes(store: Pick<PrefsCssSource, 'schema' | 'get'>, options: Pick<PrefsCssOptions, 'attribute'> = {}): Record<string, string> {
  const attribute = options.attribute ?? ((selector: string): string => `data-${kebab(selector)}`);
  const leaves = prefLeaves(store.schema);
  return Object.fromEntries([...prefSelectors(leaves).keys()].map((path) => [attribute(path), store.get(path) as string]));
}
