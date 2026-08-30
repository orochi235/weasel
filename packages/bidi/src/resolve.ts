/**
 * The Unicode Bidirectional Algorithm, rules P through I.
 *
 * This is the analysis half: text in, an embedding level per character out.
 * Turning those levels into a visual order is L1–L2, which is per *line* and
 * therefore cannot happen here — the caller wraps first and reorders after.
 */

import type { BidiClass } from './types';
import { paragraphLevelOf } from './paragraph';
import { resolveExplicit } from './explicit';
import { buildSequences } from './sequences';
import { resolveImplicit } from './implicit';

/** How the paragraph's own direction is decided. */
export type BidiDirection = 'ltr' | 'rtl' | 'auto';

export interface BidiResult {
  /** Embedding level per input character. */
  levels: Uint8Array;
  /** Class per character after the W and N rules resolved it. */
  classes: BidiClass[];
  /** X9 — true where the character is a formatting code the output drops. */
  removed: boolean[];
  paragraphLevel: 0 | 1;
}

/**
 * Resolve embedding levels for one paragraph.
 *
 * `codePoints` is optional and only feeds `N0`'s bracket pairing. Omitting it
 * costs nothing else: every other rule reads classes alone, which is how the
 * class-only half of Unicode's conformance data can drive this at all.
 */
export function resolveLevels(
  classes: readonly BidiClass[],
  direction: BidiDirection = 'auto',
  codePoints?: readonly number[],
): BidiResult {
  const paragraphLevel: 0 | 1 = direction === 'ltr' ? 0
    : direction === 'rtl' ? 1
    : paragraphLevelOf(classes);

  const explicit = resolveExplicit(classes, paragraphLevel);
  for (const seq of buildSequences(explicit)) {
    resolveImplicit(seq, explicit.classes, explicit.levels, codePoints ?? null);
  }

  return {
    levels: explicit.levels,
    classes: explicit.classes,
    removed: explicit.removed,
    paragraphLevel,
  };
}
