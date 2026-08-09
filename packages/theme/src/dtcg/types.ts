/** The one `$extensions` key this kit defines. */
export const ALPHA_EXT = 'com.weasel.alpha';

export type TokenValue = string | number | readonly (string | number)[];

export interface RawToken {
  readonly type: string;
  readonly value: TokenValue;
  /** Render the referenced color at this alpha, 0–1. */
  readonly alpha?: number | undefined;
  readonly description?: string | undefined;
}

export type FlatTokens = Record<string, RawToken>;

/** A resolved theme: every token name mapped to its final CSS-ready string.
 *  Named ...Map, not ...Tokens, to stay distinct from hud's public `ResolvedTokens`. */
export type ResolvedTokenMap = Record<string, string>;
