/**
 * @weasel-js/prefs — the preferences schema and the store over it. No React:
 * the hooks live behind `@weasel-js/prefs/react`.
 */
export {
  filterPrefSubtree,
  flattenPrefValues,
  isPrefLeaf,
  prefDisplayBounds,
  prefLeaves,
  prefValueAtPath,
  setPrefValueAtPath,
  visiblePrefSubtree,
} from './helpers';
export type { PrefAtPath, PrefPath, PrefValueAt, PrefValueOf } from './paths';
export { type PrefsMigration, runPrefsMigrations } from './migrate';
export { openPrefs, openPrefsSync, type PrefsOptions } from './open';
export { repairPrefValue, type PrefValidator } from './repair';
export { createPrefsStore, type PrefChange, type PrefsStore, VERSION_RECORD } from './store';
export {
  isBuiltinPref,
  PREF_KINDS,
  pairRowsOf,
  prefUnit,
  type BuiltinPref,
  type PrefBase,
  type PrefBoolean,
  type PrefBooleanControl,
  type PrefBooleanEncoding,
  type PrefColor,
  type PrefCustom,
  type PrefEnum,
  type PrefEnumControl,
  type PrefEnumEncoding,
  type PrefField,
  type PrefGroup,
  type PrefKind,
  type PrefLeaf,
  type PrefNumber,
  type PrefNumberControl,
  type PrefNumberUnit,
  type PrefObject,
  type PrefPaint,
  type PrefPair,
  type PrefString,
  type PrefStringControl,
} from './schema';
