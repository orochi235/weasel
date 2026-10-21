import { prefNumberAt, prefValueAtPath, type PrefLeaf, type PrefNumber } from '@weasel-js/prefs';

/** `pref` as the form holding `values` bounds it: a number leaf's `minAt` and `maxAt` read from those values. */
export function leafAtValues(pref: PrefLeaf, values: unknown): PrefLeaf {
  return pref.kind === 'number' ? prefNumberAt(pref as PrefNumber, (p) => prefValueAtPath(values, p)) : pref;
}
