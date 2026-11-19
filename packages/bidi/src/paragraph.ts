/**
 * P2/P3 and BD9 — deciding which way a paragraph reads.
 *
 * Split out because `X5c` reruns exactly this over the inside of an `FSI`:
 * a first-strong scan is the paragraph rule and the auto-direction isolate
 * rule at once, so it takes a range rather than assuming the whole text.
 */

import type { BidiClass } from './types';

/** Isolate initiators, per BD8. */
export function isIsolateInitiator(c: BidiClass): boolean {
  return c === 'LRI' || c === 'RLI' || c === 'FSI';
}

/**
 * BD9 — for each isolate initiator, the index of its matching PDI, or
 * `classes.length` when it has none; `-1` at every other index.
 *
 * One stack pass: a PDI closes the innermost open initiator, and one with
 * nothing open matches nothing. A paragraph separator ends every open initiator
 * unmatched: no isolate outlives its paragraph.
 */
export function pairIsolates(classes: readonly BidiClass[]): Int32Array {
  const n = classes.length;
  const out = new Int32Array(n).fill(-1);
  const open: number[] = [];
  const closeAll = () => {
    for (const i of open) out[i] = n;
    open.length = 0;
  };
  for (let i = 0; i < n; i++) {
    const c = classes[i];
    if (isIsolateInitiator(c)) open.push(i);
    else if (c === 'PDI') {
      const j = open.pop();
      if (j !== undefined) out[j] = i;
    } else if (c === 'B') closeAll();
  }
  closeAll();
  return out;
}

/**
 * P2/P3 — the embedding level a range reads at: 0 for left-to-right, 1 for
 * right-to-left.
 *
 * P2 skips the *contents* of an isolate: an isolate is opaque to the search by
 * definition, so a Latin word quoted inside a Hebrew paragraph cannot flip the
 * paragraph. An unmatched initiator therefore swallows everything after it,
 * which is why an all-RTL text opening with a stray `LRI` still reports 0 —
 * no strong character was ever reached, and P3's default is 0. The search
 * stops at a paragraph separator, which ends the paragraph it is reading.
 * `pdiOf` is `pairIsolates(classes)`, for a caller that already has it.
 */
export function paragraphLevelOf(
  classes: readonly BidiClass[],
  start = 0,
  end: number = classes.length,
  pdiOf: Int32Array = pairIsolates(classes),
): 0 | 1 {
  for (let i = start; i < end; i++) {
    const c = classes[i];
    if (isIsolateInitiator(c)) {
      i = Math.min(pdiOf[i], end);
      continue;
    }
    if (c === 'L') return 0;
    if (c === 'R' || c === 'AL') return 1;
    if (c === 'B') return 0;
  }
  return 0;
}
