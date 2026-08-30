/**
 * The Unicode Bidirectional Algorithm's character data, as three lookups.
 *
 * Split from the algorithm so the generated tables and the rules that consume
 * them can be tested apart — the rules are checkable against handwritten cases,
 * the tables only against Unicode's own files.
 */

/**
 * `Bidi_Class`, the property every rule in UAX #9 dispatches on.
 *
 * Grouped as the spec groups them: strong types decide direction outright, weak
 * types take it from context, neutrals take it from both sides, and the
 * explicit formatting codes drive the X rules.
 */
export type BidiClass =
  // Strong
  | 'L' | 'R' | 'AL'
  // Weak
  | 'EN' | 'ES' | 'ET' | 'AN' | 'CS' | 'NSM' | 'BN'
  // Neutral
  | 'B' | 'S' | 'WS' | 'ON'
  // Explicit embeddings and overrides
  | 'LRE' | 'RLE' | 'LRO' | 'RLO' | 'PDF'
  // Explicit isolates
  | 'LRI' | 'RLI' | 'FSI' | 'PDI';

/** One half of a bracket pair, for the `N0` rule via `BD16`. */
export interface PairedBracket {
  /** The code point that closes this one, or opens it. */
  pair: number;
  kind: 'open' | 'close';
}
