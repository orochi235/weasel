/**
 * X1–X8 — explicit embeddings, overrides and isolates.
 *
 * This is the pass that turns formatting codes into a level per character. It
 * is stack machinery rather than text analysis: nothing here looks at what the
 * characters *are* beyond their class, and the weak/neutral rules that follow
 * run over the levels this produces.
 *
 * Two asymmetries in the spec are easy to implement wrongly and are the reason
 * this file exists on its own:
 *
 * - An embedding code (`RLE`/`LRE`/`RLO`/`LRO`/`PDF`) is *removed* by X9, while
 *   an isolate initiator and its `PDI` are kept and take the level of the text
 *   *outside* the isolate. Removed characters keep their slot here, flagged in
 *   `removed`, so every array stays index-aligned with the input.
 * - Overflow is counted in two separate registers, and a `PDF` or `PDI` has to
 *   unwind overflow before it is allowed to pop anything real. Collapsing them
 *   into one counter passes simple cases and fails the conformance file.
 */

import type { BidiClass } from './types';
import { paragraphLevelOf, matchingPDI } from './paragraph';

/** BD2 — the deepest embedding level the algorithm tracks. */
export const MAX_DEPTH = 125;

export interface ExplicitResult {
  /** Embedding level per input character. */
  levels: Uint8Array;
  /** Class per input character, rewritten where an override applied. */
  classes: BidiClass[];
  /** X9 — true where the character is an embedding or pop code, or `BN`. */
  removed: boolean[];
  paragraphLevel: 0 | 1;
}

type Override = 'neutral' | 'L' | 'R';

interface StackEntry {
  level: number;
  override: Override;
  isolate: boolean;
}

function nextOdd(level: number): number {
  return level + 1 + ((level + 1) % 2 === 0 ? 1 : 0);
}
function nextEven(level: number): number {
  return level + 1 + ((level + 1) % 2 === 0 ? 0 : 1);
}

function isRemovedByX9(c: BidiClass): boolean {
  return c === 'RLE' || c === 'LRE' || c === 'RLO' || c === 'LRO'
    || c === 'PDF' || c === 'BN';
}

export function resolveExplicit(
  input: readonly BidiClass[],
  paragraphLevel: 0 | 1,
): ExplicitResult {
  const n = input.length;
  const classes = input.slice();
  const levels = new Uint8Array(n);
  const removed = new Array<boolean>(n).fill(false);

  // X1.
  const stack: StackEntry[] = [
    { level: paragraphLevel, override: 'neutral', isolate: false },
  ];
  let overflowIsolate = 0;
  let overflowEmbedding = 0;
  let validIsolate = 0;
  const top = (): StackEntry => stack[stack.length - 1];

  for (let i = 0; i < n; i++) {
    const c = classes[i];

    switch (c) {
      // X2–X5: embeddings and overrides.
      case 'RLE': case 'LRE': case 'RLO': case 'LRO': {
        // The code itself takes the level in force *before* it, then is
        // removed; the level it computes applies to what follows.
        levels[i] = top().level;
        removed[i] = true;
        const rtl = c === 'RLE' || c === 'RLO';
        const level = rtl ? nextOdd(top().level) : nextEven(top().level);
        const override: Override = c === 'RLO' ? 'R' : c === 'LRO' ? 'L' : 'neutral';
        if (level <= MAX_DEPTH && overflowIsolate === 0 && overflowEmbedding === 0) {
          stack.push({ level, override, isolate: false });
        } else if (overflowIsolate === 0) {
          overflowEmbedding++;
        }
        break;
      }

      // X5a–X5c: isolates. The initiator is kept and sits outside.
      case 'RLI': case 'LRI': case 'FSI': {
        let rtl = c === 'RLI';
        if (c === 'FSI') {
          // X5c — first-strong over the contents, which is P2/P3 again.
          rtl = paragraphLevelOf(classes, i + 1, matchingPDI(classes, i, n)) === 1;
        }
        levels[i] = top().level;
        if (top().override !== 'neutral') classes[i] = top().override as BidiClass;
        const level = rtl ? nextOdd(top().level) : nextEven(top().level);
        if (level <= MAX_DEPTH && overflowIsolate === 0 && overflowEmbedding === 0) {
          validIsolate++;
          stack.push({ level, override: 'neutral', isolate: true });
        } else {
          overflowIsolate++;
        }
        break;
      }

      // X6a.
      case 'PDI': {
        if (overflowIsolate > 0) {
          overflowIsolate--;
        } else if (validIsolate > 0) {
          // An unmatched embedding inside the isolate dies with it, so the
          // embedding overflow register resets rather than surviving the pop.
          overflowEmbedding = 0;
          while (!top().isolate) stack.pop();
          stack.pop();
          validIsolate--;
        }
        // Whether or not it popped, a PDI takes the level now in force.
        levels[i] = top().level;
        if (top().override !== 'neutral') classes[i] = top().override as BidiClass;
        break;
      }

      // X7.
      case 'PDF': {
        levels[i] = top().level;
        removed[i] = true;
        if (overflowIsolate > 0) {
          // An isolate outranks it: the PDF belongs to text already discarded.
        } else if (overflowEmbedding > 0) {
          overflowEmbedding--;
        } else if (!top().isolate && stack.length >= 2) {
          stack.pop();
        }
        break;
      }

      // X8 — a paragraph separator always returns to the paragraph level.
      case 'B': {
        levels[i] = paragraphLevel;
        break;
      }

      case 'BN': {
        levels[i] = top().level;
        removed[i] = true;
        break;
      }

      // X6 — everything else.
      default: {
        levels[i] = top().level;
        if (top().override !== 'neutral') classes[i] = top().override as BidiClass;
        break;
      }
    }
  }

  return { levels, classes, removed, paragraphLevel };
}

/** Convenience for callers that want X9's removals applied as a filter. */
export function keptIndices(r: ExplicitResult): number[] {
  const out: number[] = [];
  for (let i = 0; i < r.removed.length; i++) if (!r.removed[i]) out.push(i);
  return out;
}

export { isRemovedByX9 };
