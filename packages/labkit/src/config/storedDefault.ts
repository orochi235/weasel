import type { PrefLeaf } from '@weasel-js/prefs';

/** Whether `leaf` stores something other than what its row shows, read back through its `encoding`. */
export const isEncodedLeaf = (leaf: PrefLeaf): boolean =>
  (leaf as { encoding?: unknown }).encoding !== undefined;

/** What a config holds for `leaf` at its default. An encoded leaf's default is the option it reads as, not
 *  what it stores, and holding nothing reads as it. */
export const storedDefault = (leaf: PrefLeaf): unknown =>
  isEncodedLeaf(leaf) ? undefined : leaf.default;
