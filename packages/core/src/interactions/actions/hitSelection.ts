/** What selecting `hits` selects: each hit's `targetOf`, first answer kept,
 *  or the hits themselves when there is no `targetOf`. */
export function hitTargets<T extends string>(hits: readonly T[], targetOf?: (id: T) => T): T[] {
  return targetOf ? [...new Set(hits.map(targetOf))] : [...hits];
}

/** The selection a hit list leaves behind: the hits alone, or, when the
 *  gesture extends the selection, the current ids with the new hits after them. */
export function selectionFromHits<T extends string>(
  current: readonly T[],
  hits: readonly T[],
  extend: boolean,
): T[] {
  return [...new Set(extend ? [...current, ...hits] : hits)];
}
