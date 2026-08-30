/**
 * P2/P3 and BD9 — deciding which way a paragraph reads.
 *
 * Split out because `X5c` reruns exactly this over the inside of an `FSI`:
 * a first-strong scan is the paragraph rule and the auto-direction isolate
 * rule at once, so it takes a range rather than assuming the whole text.
 */

import type { BidiClass } from './types';

/** Isolate initiators, per BD8. */
function isIsolateInitiator(c: BidiClass): boolean {
  return c === 'LRI' || c === 'RLI' || c === 'FSI';
}

/**
 * BD9 — the index of the PDI matching the initiator at `start`, or `end` when
 * it has none.
 *
 * Depth-counted rather than nearest-match: a nested isolate consumes its own
 * PDI, so the first PDI encountered is usually not the answer.
 */
export function matchingPDI(
  classes: readonly BidiClass[],
  start: number,
  end: number = classes.length,
): number {
  let depth = 1;
  for (let i = start + 1; i < end; i++) {
    const c = classes[i];
    if (isIsolateInitiator(c)) depth++;
    else if (c === 'PDI' && --depth === 0) return i;
  }
  return end;
}

/**
 * P2/P3 — the embedding level a range reads at: 0 for left-to-right, 1 for
 * right-to-left.
 *
 * P2 skips the *contents* of an isolate: an isolate is opaque to the search by
 * definition, so a Latin word quoted inside a Hebrew paragraph cannot flip the
 * paragraph. An unmatched initiator therefore swallows everything after it,
 * which is why an all-RTL text opening with a stray `LRI` still reports 0 —
 * no strong character was ever reached, and P3's default is 0.
 */
export function paragraphLevelOf(
  classes: readonly BidiClass[],
  start = 0,
  end: number = classes.length,
): 0 | 1 {
  for (let i = start; i < end; i++) {
    const c = classes[i];
    if (isIsolateInitiator(c)) {
      i = matchingPDI(classes, i, end);
      continue;
    }
    if (c === 'L') return 0;
    if (c === 'R' || c === 'AL') return 1;
  }
  return 0;
}
