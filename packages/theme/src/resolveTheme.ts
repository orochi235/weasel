import { resolveTokens } from './dtcg/resolve';
import type { FlatTokens } from './dtcg/types';
import type { Theme } from './theme';
import type { TokenName } from './generated/themes';

/** The output of `resolveTheme`: every token of a theme, for one mode, keyed
 *  by CSS custom-property name and flattened to a final CSS value. */
export type ResolvedTheme = Readonly<Record<TokenName, string>>;

/** Root-first so the leaf theme's overrides land last. */
function chain(theme: Theme): Theme[] {
  const out: Theme[] = [];
  for (let t: Theme | null = theme; t; t = t.extends) out.unshift(t);
  return out;
}

/**
 * Merge the extends chain, layer the mode over it, resolve every alias, and
 * key the result by CSS custom-property name.
 *
 * Pure — no DOM. An unresolvable reference throws rather than falling back.
 */
export function resolveTheme(theme: Theme, mode: string): ResolvedTheme {
  const themes = chain(theme);
  const effectiveMode = themes.some((t) => mode in t.modes) ? mode : theme.defaultMode;

  // Each theme contributes its mode-invariant tokens and then its mode layer,
  // before the next theme down the chain gets a turn. Collecting all `tokens`
  // first and all mode layers second would let the *base's* mode layer outrank
  // a derived theme's deliberate mode-invariant override.
  let merged: FlatTokens = {};
  for (const t of themes) {
    merged = { ...merged, ...t.tokens, ...(t.modes[effectiveMode] ?? {}) };
  }

  const resolved = resolveTokens(merged);
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(resolved)) out[`--wzl-${name}`] = value;
  return out as ResolvedTheme;
}
