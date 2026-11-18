import { prefBoundedNumber, prefValueAt, type PrefLeaf, type PrefNumber } from '@weasel-js/prefs';

/** `pref` as the form holding `values` bounds it: a number leaf's `minAt` and `maxAt` read from those values. */
export function leafAtValues(pref: PrefLeaf, values: unknown): PrefLeaf {
  return pref.kind === 'number' ? prefBoundedNumber(pref as PrefNumber, (p) => prefValueAt(values, p)) : pref;
}
