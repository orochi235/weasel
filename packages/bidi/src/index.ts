/**
 * The Unicode Bidirectional Algorithm (UAX #9).
 *
 * Plain data in, plain data out: code points and a direction go in, embedding
 * levels and a visual order come out.
 *
 * Two calls, because the algorithm splits at exactly one place: `analyze` is
 * per paragraph, `reorder` is per *line*. A caller wraps between them, and one
 * analysis serves every line the wrap produced.
 */

import type { BidiClass } from './types';
import { resolveLevels, type BidiDirection, type BidiResult } from './resolve';
import { reorderLine, type ReorderedLine } from './reorder';
import { bidiClassOf, mirrorOf } from './tables';

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

/** Analyze one paragraph of text. `direction` defaults to `'auto'`, which is
 *  P2/P3's first-strong rule. */
export function analyze(
  codePoints: readonly number[],
  direction: BidiDirection = 'auto',
): BidiAnalysis {
  const original = Array.from(codePoints, bidiClassOf);
  const resolved = resolveLevels(original, direction, codePoints);
  return { ...resolved, original };
}

/** Order one line of an analyzed paragraph for display, left to right.
 *  `start` and `end` index the same code point array `analyze` was given,
 *  with `0 <= start <= end <=` its length; any other range throws a `RangeError`. */
export function reorder(
  analysis: BidiAnalysis,
  start: number,
  end: number,
): ReorderedLine {
  return reorderLine(analysis.original, analysis, start, end);
}

/**
 * The level an analysed paragraph reads at: 0 left to right, 1 right to left.
 * Under `'auto'` this is where P2/P3's first-strong answer comes back out.
 */
export function paragraphLevel(analysis: BidiAnalysis): 0 | 1 {
  return analysis.paragraphLevel;
}

/** The whole seam a text layout needs, and all this package is used through. */
export interface BidiEngine {
  analyze(codePoints: readonly number[], direction?: BidiDirection): BidiAnalysis;
  reorder(analysis: BidiAnalysis, start: number, end: number): ReorderedLine;
  /** L4, applied at paint time against a character's resolved level: `mirrorOf`. */
  mirror(cp: number): number | null;
  paragraphLevel(analysis: BidiAnalysis): 0 | 1;
}

/** The default engine — pass this where a `BidiEngine` is wanted. */
export const bidi: BidiEngine = { analyze, reorder, mirror: mirrorOf, paragraphLevel };
