import { fullSelection, mergeAxes, pickAll, type AxisDefs, type Selection } from './axes.ts';
import { resolveTokens } from './dtcg/resolve.ts';
import type { FlatTokens } from './dtcg/types.ts';
import type { TokenName } from './generated/themes.ts';
import type { Theme } from './theme.ts';

/** The output of `resolveTheme`: every token of a theme, for one selection, keyed
 *  by CSS custom-property name and flattened to a final CSS value. */
export type ResolvedTheme = Readonly<Record<TokenName, string>>;

/** Root-first, so the leaf theme's tokens land last. */
export function themeChain(theme: Theme): Theme[] {
  const out: Theme[] = [];
  for (let t: Theme | null = theme; t; t = t.extends) out.unshift(t);
  return out;
}

/** Every axis the chain declares. An axis declared more than once keeps every value; a descendant's value entries and default win. */
export function themeAxes(theme: Theme): AxisDefs {
  return themeChain(theme).reduce<AxisDefs>((axes, t) => mergeAxes(axes, t.axes), {});
}

/**
 * Merge the extends chain at a selection, resolve every alias, and key the
 * result by CSS custom-property name. A missing or unknown axis value takes the
 * axis default.
 *
 * Pure — no DOM. An unresolvable reference throws rather than falling back.
 */
export function resolveTheme(theme: Theme, selection: Selection = {}): ResolvedTheme {
  const sel = fullSelection(themeAxes(theme), selection);
  let merged: FlatTokens = {};
  for (const t of themeChain(theme)) merged = { ...merged, ...pickAll(t.tokens, sel) };
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(resolveTokens(merged))) out[`--wzl-${name}`] = value;
  return out as ResolvedTheme;
}
