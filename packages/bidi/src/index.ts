/**
 * The Unicode Bidirectional Algorithm (UAX #9).
 *
 * Plain data in, plain data out: code points and a direction go in, embedding
 * levels and a visual order come out. Nothing here knows about fonts, glyphs,
 * canvases or the DOM, and nothing in weasel depends on this package — a text
 * layout that wants bidi is handed an implementation of this shape, and one
 * that is not handed one lays out in logical order.
 *
 * Two calls, because the algorithm splits at exactly one place: `analyze` is
 * per paragraph, `reorder` is per *line*. A caller wraps between them, and one
 * analysis serves every line the wrap produced.
 *
 * Verified against Unicode's own conformance data — all 91,707 cases of
 * `BidiCharacterTest.txt` and all 490,846 of `BidiTest.txt`.
 */

import type { BidiClass } from './types';
import { resolveLevels, type BidiDirection, type BidiResult } from './resolve';
import { reorderLine, type ReorderedLine } from './reorder';
import { bidiClassOf, mirrorOf, UNICODE_VERSION } from './tables';

export type { BidiClass, PairedBracket } from './types';
export type { BidiDirection, BidiResult } from './resolve';
export type { ReorderedLine } from './reorder';
export { bidiClassOf, mirrorOf, pairedBracket, UNICODE_VERSION } from './tables';
export { resolveLevels } from './resolve';
export { reorderLine } from './reorder';

/** One analysed paragraph, and the classes it was analysed from. */
export interface BidiAnalysis extends BidiResult {
  /** `Bidi_Class` per code point, before the W and N rules rewrote anything.
   *  L1 is specified against these, so `reorder` needs them kept. */
  original: BidiClass[];
}

/**
 * Analyse one paragraph of text.
 *
 * `direction` defaults to `'auto'`, which is P2/P3's first-strong rule — the
 * right default for text whose language is not known up front.
 */
export function analyze(
  codePoints: readonly number[],
  direction: BidiDirection = 'auto',
): BidiAnalysis {
  const original = Array.from(codePoints, bidiClassOf);
  const resolved = resolveLevels(original, direction, codePoints);
  return { ...resolved, original };
}

/**
 * Order one line of an analysed paragraph for display, left to right.
 *
 * `start` and `end` index the same code point array `analyze` was given.
 */
export function reorder(
  analysis: BidiAnalysis,
  start: number,
  end: number,
): ReorderedLine {
  return reorderLine(analysis.original, analysis, start, end);
}

/**
 * L4 — the glyph to paint in place of `cp` when it sits in a right-to-left
 * run, or `null` when it is not mirrored.
 *
 * Applied at paint time against a character's resolved level, not during
 * analysis: the same code point mirrors in one run and not in another.
 */
export function mirror(cp: number): number | null {
  return mirrorOf(cp);
}

/** The whole seam a text layout needs, and all this package is used through. */
export interface BidiEngine {
  analyze(codePoints: readonly number[], direction?: BidiDirection): BidiAnalysis;
  reorder(analysis: BidiAnalysis, start: number, end: number): ReorderedLine;
  mirror(cp: number): number | null;
}

/** The default engine — pass this where a `BidiEngine` is wanted. */
export const bidi: BidiEngine = { analyze, reorder, mirror };

export { UNICODE_VERSION as BIDI_UNICODE_VERSION };
