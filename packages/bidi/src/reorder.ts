/**
 * L1 and L2 — turning embedding levels into a visual order, one line at a time.
 *
 * These are the only rules that know about lines, which is why they are split
 * from `resolveLevels`: a caller wraps text into lines *after* the paragraph is
 * analysed, and the same paragraph analysis then serves every line it broke
 * into. Running L1 during the analysis would reset whitespace against the
 * paragraph's end rather than each line's.
 */

import type { BidiClass } from './types';
import type { BidiResult } from './resolve';

export interface ReorderedLine {
  /**
   * Original indices in visual order, left to right, with the characters X9
   * removed omitted.
   */
  order: number[];
  /**
   * Level per original index over the line, after L1. `-1` where X9 removed
   * the character.
   */
  levels: Int16Array;
}

/** Whitespace and isolate formatting — what L1 sweeps up alongside a reset. */
function isResettable(c: BidiClass): boolean {
  return c === 'WS' || c === 'FSI' || c === 'LRI' || c === 'RLI' || c === 'PDI';
}

/**
 * Reorder `[start, end)` of an analysed paragraph.
 *
 * `original` must be the classes as they were *before* analysis: L1 is defined
 * against them, and by this point `resolved.classes` has rewritten the very
 * whitespace L1 is looking for.
 */
export function reorderLine(
  original: readonly BidiClass[],
  resolved: BidiResult,
  start: number,
  end: number,
): ReorderedLine {
  const { levels: paraLevels, removed, paragraphLevel } = resolved;

  const levels = new Int16Array(end - start).fill(-1);
  const kept: number[] = [];
  for (let i = start; i < end; i++) {
    if (removed[i]) continue;
    levels[i - start] = paraLevels[i];
    kept.push(i);
  }
  if (kept.length === 0) return { order: [], levels };

  // L1, clauses 1 and 2: separators themselves. Clause 3 then walks back over
  // any whitespace leading into one.
  for (const i of kept) {
    const c = original[i];
    if (c !== 'S' && c !== 'B') continue;
    levels[i - start] = paragraphLevel;
    for (let k = kept.indexOf(i) - 1; k >= 0; k--) {
      const j = kept[k];
      if (!isResettable(original[j])) break;
      levels[j - start] = paragraphLevel;
    }
  }

  // L1 clause 4: a trailing run of whitespace ends against the paragraph, not
  // against whatever the neutral rules made of it mid-paragraph.
  for (let k = kept.length - 1; k >= 0; k--) {
    const j = kept[k];
    if (!isResettable(original[j])) break;
    levels[j - start] = paragraphLevel;
  }

  // L2: from the highest level down to the lowest odd one, reverse every
  // contiguous stretch at or above that level. Reversing repeatedly rather
  // than sorting is what nests correctly — an inner run reversed twice comes
  // back to its own reading order.
  const order = kept.slice();
  let highest = 0;
  let lowestOdd = Number.MAX_SAFE_INTEGER;
  for (const i of kept) {
    const l = levels[i - start];
    if (l > highest) highest = l;
    if (l % 2 === 1 && l < lowestOdd) lowestOdd = l;
  }

  for (let level = highest; level >= lowestOdd; level--) {
    for (let a = 0; a < order.length; a++) {
      if (levels[order[a] - start] < level) continue;
      let b = a;
      while (b + 1 < order.length && levels[order[b + 1] - start] >= level) b++;
      for (let lo = a, hi = b; lo < hi; lo++, hi--) {
        const t = order[lo];
        order[lo] = order[hi];
        order[hi] = t;
      }
      a = b;
    }
  }

  return { order, levels };
}
