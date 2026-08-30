/**
 * The bidi contract, declared here and implemented elsewhere.
 *
 * This package does not depend on `@weasel-js/bidi` and must not: the point of
 * naming the interface on this side is that a consumer who renders no
 * right-to-left text never installs the Unicode tables, and that a different
 * implementation can be substituted without weasel knowing. `@weasel-js/bidi`
 * satisfies this structurally, importing nothing from here.
 *
 * Two calls because the algorithm splits at one place: analysis is per
 * paragraph, reordering is per line. `layoutRuns` wraps between them.
 */

/** Opaque to this package — whatever the engine needs to carry between calls. */
export type BidiAnalysis = unknown;

export interface BidiReordering {
  /**
   * Positions in the analysed sequence, in visual order, left to right.
   * A position the engine drops (a formatting control) is simply absent.
   */
  order: readonly number[];
  /** Resolved embedding level per position in the line's range. */
  levels: ArrayLike<number>;
}

export interface BidiResolver {
  analyze(codePoints: readonly number[], direction?: 'ltr' | 'rtl' | 'auto'): BidiAnalysis;
  reorder(analysis: BidiAnalysis, start: number, end: number): BidiReordering;
  /** L4 — the mirrored form for a character in a right-to-left run, or null. */
  mirror(cp: number): number | null;
}
