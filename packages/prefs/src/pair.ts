import { pairRowsOf, type PrefLeaf } from './schema';

/** Neighboring items one row draws, in {@link pairRuns}' answer. */
export interface PairRun<T> {
  items: T[];
  /** The pairing the items share: the path of the leaf that declared it, and what the row reads. Absent on a
   *  run of one, which is no pair. */
  pair?: { key: string; label: string };
}

/**
 * `items` as the rows they draw, in order: each leaf a `pair` names joins the row of the leaf naming it where
 * the two are neighbors, and every other item is a run of its own. `leafOf` gives an item's leaf and the path a
 * `pair` would name it by, or nothing for an item that shares no row, which ends a run.
 */
export function pairRuns<T>(
  items: readonly T[],
  leafOf: (item: T) => readonly [path: string, leaf: PrefLeaf] | undefined,
): PairRun<T>[] {
  const leaves = items.map(leafOf);
  const pairs = pairRowsOf(leaves.filter((entry) => entry !== undefined));
  const keys = leaves.map((entry) => (entry === undefined ? undefined : pairs.get(entry[0])));
  const runs: PairRun<T>[] = [];
  for (let i = 0; i < items.length; ) {
    const pair = keys[i];
    let j = i + 1;
    while (pair !== undefined && keys[j]?.key === pair.key) j += 1;
    runs.push(j - i > 1 ? { items: items.slice(i, j), pair } : { items: [items[i]!] });
    i = j;
  }
  return runs;
}
