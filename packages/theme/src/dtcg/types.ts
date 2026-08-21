/** The one `$extensions` key this kit defines. */
export const ALPHA_EXT = 'com.weasel.alpha';

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
}

/** A token graph flattened to one level, keyed by token name (no `--wzl-`
 *  prefix). Still unresolved — see `ResolvedTokenMap` for the output side. */
export type FlatTokens = Record<string, RawToken>;

/** A resolved theme: every token name mapped to its final CSS-ready string.
 *  Named ...Map, not ...Tokens, to stay distinct from hud's public `ResolvedTokens`. */
export type ResolvedTokenMap = Record<string, string>;
