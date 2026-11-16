import type { PrefLeaf } from './schema';

/** Whether `held` is no value at all for `leaf`: `undefined`, or `null` except a paint's, which is "no paint". */
export function prefValueAbsent(leaf: PrefLeaf, held: unknown): boolean {
  return held === undefined || (held === null && leaf.kind !== 'paint');
}

/**
 * What a params surface shows for the value held at `leaf`: that value, else
 * the leaf's default. A clearable leaf holding nothing is cleared, and shows
 * nothing. `unset` is for a surface where holding nothing means the owner has
 * no such property, a scene node's: it shows nothing there too.
 */
export function prefLeafValue(leaf: PrefLeaf, held: unknown, { unset = false }: { unset?: boolean } = {}): unknown {
  if (!prefValueAbsent(leaf, held)) return held;
  if (unset || (leaf as { clearable?: boolean }).clearable === true) return undefined;
  return (leaf as { default?: unknown }).default;
}
