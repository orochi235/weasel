import type { FlatTokens, RawToken } from './dtcg/types';
import { THEME_SOURCES } from './generated/themes';

/** Authoring shorthand: a bare string is a literal or a `{ref}`. */
export type TokenInput = string | number | RawToken;

/** What `defineTheme` accepts: a name, the base theme to layer onto, and the
 *  token overrides, split into mode-invariant and per-mode. */
export interface ThemeInput {
  readonly name: string;
  /** Base to layer onto. Defaults to `weaselTheme`; `null` opts out. */
  readonly extends?: Theme | null;
  readonly defaultMode?: string;
  /** Mode-invariant overrides. */
  readonly tokens?: Readonly<Record<string, TokenInput>>;
  readonly modes: Readonly<Record<string, Readonly<Record<string, TokenInput>>>>;
}

/**
 * A theme: a named set of design tokens, organized into a mode-invariant layer
 * plus one layer per mode (light, dark, …), optionally extending another theme.
 * Tokens are held unresolved — aliases between them are collapsed later by
 * `resolveTheme`, so an override of a base primitive still reaches everything
 * that references it.
 */
export interface Theme {
  readonly name: string;
  readonly extends: Theme | null;
  readonly defaultMode: string;
  readonly tokens: FlatTokens;
  readonly modes: Readonly<Record<string, FlatTokens>>;
}

function normalize(input: Readonly<Record<string, TokenInput>>): FlatTokens {
  const out: FlatTokens = {};
  for (const [name, v] of Object.entries(input)) {
    out[name] =
      typeof v === 'object'
        ? v
        : { type: 'unknown', value: v, alpha: undefined, description: undefined };
  }
  return out;
}

/** The built-in theme, materialized from the generated source. */
export const weaselTheme: Theme = {
  name: 'weasel',
  extends: null,
  defaultMode: 'dark',
  tokens: THEME_SOURCES.weasel.primitives as FlatTokens,
  modes: THEME_SOURCES.weasel.modes as Record<string, FlatTokens>,
};

/** Build a theme from authoring shorthand. Unless `extends` says otherwise the
 *  result layers onto `weaselTheme`, so a theme only needs to name what it
 *  changes. */
export function defineTheme(input: ThemeInput): Theme {
  const base = input.extends === undefined ? weaselTheme : input.extends;
  const modes: Record<string, FlatTokens> = {};
  for (const [mode, tokens] of Object.entries(input.modes)) modes[mode] = normalize(tokens);
  return {
    name: input.name,
    extends: base,
    defaultMode: input.defaultMode ?? base?.defaultMode ?? 'dark',
    tokens: normalize(input.tokens ?? {}),
    modes,
  };
}
