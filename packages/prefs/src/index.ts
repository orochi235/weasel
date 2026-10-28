/**
 * @weasel-js/prefs — the preferences schema and the store over it. No React:
 * the hooks live behind `@weasel-js/prefs/react`.
 *
 * @packageDocumentation
 */
export {
  filterPrefSubtree,
  flattenPrefValues,
  isPrefLeaf,
  isPrefSection,
  prefDisplayBounds,
  prefHoldsValue,
  prefLeafAt,
  prefLeaves,
  prefSectionLeaves,
  prefValueAtPath,
  VERSION_RECORD,
  visiblePrefSubtree,
} from './helpers';
export { prefClampNumber, prefNumberAt, type PrefBoundAt, type PrefBoundReader } from './bounds';
export type { PrefAction, PrefActionContext, PrefActionControl, PrefActions } from './action';
export { prefTabRuns, type PrefTabRun } from './tabRuns';
export { prefLeavesTagged, prefLeafTags } from './tags';
export {
  isPrefCondition,
  mapPrefConditionPaths,
  prefConditionHolds,
  prefConditionPaths,
  prefConditionReadsItem,
  prefIsEnabled,
  prefIsShown,
  type PrefCondition,
  type PrefConditionReader,
  type PrefConditionValue,
  type PrefTest,
} from './condition';
export {
  checkPrefCondition,
  checkPrefConditions,
  type PrefConditionProblem,
  type PrefConditionSite,
  type PrefSchemaConditionProblem,
} from './conditionCheck';
export {
  applyPrefConditions,
  applyPrefEntryConditions,
  PREF_ENTRY,
  PREF_SCOPE,
  prefJudge,
  prefReader,
  prefScopeAt,
  prefScopeIn,
  prefSectionPath,
  prefScopeUnder,
  type PrefConditionField,
  type PrefConditionJudge,
  type PrefConditionsApplied,
  type PrefConditionsOptions,
  type PrefEntry,
  type PrefEntryApplied,
  type PrefOwner,
  type PrefScope,
  type PrefScopeAtOptions,
} from './scope';
export { prefShownReader, prefShownValue } from './shown';
export { prefLeafValue, prefValueAbsent } from './leafValue';
export { isPrefLocus, locusSelectors as prefLocusSelectors, memberAt as prefLocusMember, type PrefLocus, type PrefSelection, type PrefWeighted, type PrefWeights } from './locus';
export { prefWeightAxes, type PrefWeightAxes } from './weightAxes';
export { PREF_BLENDS, type PrefBlend } from './blend';
export { checkPrefSplits, type PrefSplitProblem } from './splitCheck';
export { pref } from './build';
export { prefsCss, prefsCssAttributes, type PrefsCssOptions, type PrefsCssSource } from './css';
export { prefsDefaultsSource } from './defaultsSource';
export { kitSettingsCssOptions } from './kitCss';
export { prefSchemaHolding } from './holding';
export { prefAliasedLeaf, prefAliasName, prefAliasTarget, type PrefAlias } from './alias';
export { prefAliasTargets, type PrefAliasTargets, type PrefAliasTargetsOptions } from './aliasTargets';
export type { PrefLabel, PrefSeparator } from './label';
export { prefObjectBase, prefObjectWithField } from './object';
export type { PrefList, PrefListControl } from './list';
export type { PrefMap } from './map';
export { prefVariantDefault, prefVariantOf, type PrefUnion } from './union';
export { prefType } from './type';
export { prefAsBox, prefGroupIsPage } from './groups';
export { prefFitsHeading, prefHeadingKey } from './heading';
export type { PrefBarLead, PrefBarOverflow, PrefGroup, PrefGroupAs, PrefSection, PrefSectionAs } from './groups';
export type { PrefAtPath, PrefPath, PrefValueAt, PrefValueOf } from './paths';
export type { PrefsMigration } from './migrate';
export { openPrefs, openPrefsSync, type PrefsOptions } from './open';
export { repairPrefValue, type PrefValidator } from './repair';
export type { PrefChange, PrefsStore } from './store';
export {
  isPrefLinearUnit,
  prefUnit,
  prefUnitAccepts,
  resolvePrefUnit,
  type PrefFunctionUnit,
  type PrefLinearUnit,
  type PrefNumberUnit,
  type ResolvedPrefUnit,
} from './unit';
export { prefLeafInScopes, scopedPrefUnit } from './scopedUnit';
export { pairRuns, type PairRun } from './pair';
export { PREF_KIND_TRAITS, prefDrawsSeveral, prefIsCompound, type PrefKindTraits } from './kinds';
export {
  isBuiltinPref,
  PREF_KINDS,
  pairRowsOf,
  type BuiltinPref,
  type PrefBase,
  type PrefValueBase,
  type PrefBoolean,
  type PrefBooleanControl,
  type PrefBooleanEncoding,
  type PrefColor,
  type PrefCustom,
  type PrefEnum,
  type PrefEnumBase,
  type PrefNumberBase,
  type PrefEnumControl,
  type PrefEnumEncoding,
  type PrefField,
  type PrefKind,
  type PrefLeaf,
  type PrefNumber,
  type PrefNumberControl,
  type PrefObject,
  type PrefPaint,
  type PrefPair,
  type PrefString,
  type PrefStringControl,
} from './schema';
export { mergePrefGroups } from './merge';
export { orderPrefGroup, resolveOrder, type PrefOrder } from './order';
