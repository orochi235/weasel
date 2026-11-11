/** A token's alpha, as a token's `$extensions` key. */
export const ALPHA_EXT = 'com.weasel.alpha';
/** The axes a token's pref is scoped by, as a token's `$extensions` key. */
export const SCOPE_EXT = 'com.weasel.scope';

/** A reference reads a dot as a group, and a name reaches CSS custom properties and the generated module unescaped. */
const SAFE_NAME = /^[A-Za-z0-9_-]+$/;

/** Whether `name` can name a token: letters, digits, `-` and `_`, and not `__proto__`, which a record cannot hold as a key. */
export const isSafeTokenName = (name: string): boolean => SAFE_NAME.test(name) && name !== '__proto__';

/** Why `name` cannot name a token. */
export const unsafeTokenName = (name: string): string =>
  name === '__proto__' ? '"__proto__" cannot name a token' : `"${name}" cannot name a token: use letters, digits, "-" and "_"`;

/** A token's value as authored: a string (which may be a `{ref}`), a number, or a list of those, such as a font stack. */
export type TokenValue = string | number | readonly (string | number)[];

/**
 * A single design token as authored, before aliases are resolved: a DTCG-shaped
 * `{ type, value }` pair where `value` may still be a `{ref}` to another token.
 */
export interface RawToken {
  readonly type: string;
  readonly value: TokenValue;
  /** Render the referenced color at this alpha, 0–1. */
  readonly alpha?: number | undefined;
  readonly description?: string | undefined;
  /** Axes the token's pref is scoped by even where its values do not differ along them. */
  readonly scope?: readonly string[] | undefined;
}

/** A token graph flattened to one level, keyed by token name (no `--wzl-`
 *  prefix). Still unresolved — see `ResolvedTokenMap` for the output side. */
export type FlatTokens = Record<string, RawToken>;

/** A resolved theme: every token name mapped to its final CSS-ready string.
 *  Named ...Map, not ...Tokens, to stay distinct from hud's public `ResolvedTokens`. */
export type ResolvedTokenMap = Record<string, string>;
