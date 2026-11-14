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
export type { PrefAction, PrefActionContext, PrefActionControl, PrefActions, PrefGrade } from './action';
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
  PREF_CONDITION_FIELDS,
  PREF_ENTRY,
  PREF_STATUS,
  prefJudge,
  prefReader,
  prefStatusAt,
  prefStatusIn,
  prefSectionPath,
  prefStatusUnder,
  type PrefConditionField,
  type PrefConditionJudge,
  type PrefConditionsApplied,
  type PrefConditionsOptions,
  type PrefEntry,
  type PrefEntryApplied,
  type PrefOwner,
  type PrefStatus,
  type PrefStatusAtOptions,
} from './status';
export { prefShownReader, prefShownValue } from './shown';
export { prefLeafValue, prefValueAbsent } from './leafValue';
export {
  prefAutoValue,
  prefCanAuto,
  prefIsReset,
  prefResetOf,
  prefResets,
  prefStartsAuto,
  prefStoredReset,
  type PrefReset,
  type PrefResetEntry,
  AUTO,
  leafIsAtReset,
  resetPlan,
  resetPlanAt,
  prefNodeAt,
  type Auto,
  type LeafReading,
  type ResetWrite,
} from './autoReset';
export {
  isPrefScope,
  scopeSelectors as prefScopeSelectors,
  memberAt as prefScopeValue,
  overrideOptions as prefOverrideOptions,
  scopeOptionValue as prefScopeOptionValue,
  PREF_ELSE,
  type PrefScope,
  type PrefSelection,
  type PrefOverrides,
  type PrefWeighted,
  type PrefWeights,
} from './scope';
export { prefWeightAxes, type PrefWeightAxes } from './weightAxes';
export { PREF_BLENDS, type PrefBlend } from './blend';
export { checkPrefSplits, type PrefSplitProblem } from './splitCheck';
export { prefOverridesOf, prefScopedDefault, prefScopesOf, type PrefScopeSpec } from './scopeSpec';
export { pref } from './build';
export { prefsCss, prefsCssAttributes, type PrefsCssOptions, type PrefsCssSource } from './css';
export { prefsDefaultsSource } from './defaultsSource';
export { kitSettingsCssOptions } from './kitCss';
export { prefSchemaHolding } from './holding';
export { prefAliasedLeaf, prefAliasName, prefAliasTarget, type PrefAlias } from './alias';
export { prefAliasTargets, type PrefAliasTargets, type PrefAliasTargetsOptions } from './aliasTargets';
export type { PrefLabel, PrefSeparator } from './label';
export { prefObjectBase, prefObjectField, prefObjectWithField } from './object';
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
  PX_UNIT,
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
  type PrefAuto,
  type PrefBase,
  type PrefValueBase,
  type PrefBoolean,
  type PrefBooleanControl,
  type PrefBooleanEncoding,
  type PrefColor,
  type PrefCustom,
  type PrefEnum,
  type PrefEnumBase,
  type PrefEnumOption,
  type PrefNumberBase,
  type PrefEnumControl,
  type PrefEnumEncoding,
  type PrefField,
  type PrefKind,
  type PrefLeaf,
  type PrefNumber,
  type PrefNumberControl,
  type PrefNumberScale,
  type PrefObject,
  type PrefPaint,
  type PrefPair,
  type PrefString,
  type PrefStringControl,
} from './schema';
export { mergePrefGroups } from './merge';
export { orderPrefGroup, resolveOrder, type PrefOrder } from './order';
export { LEAF_FREE, sharedReading, type LeafState, type PrefsSource, type SourceWriteOptions } from './sources/prefsSource';
export { leafAtReset, resetReading, sourceIsAtReset, sourceResetPlan, writePlan } from './sources/policy';
export { recordSource, valuesSource, type ValuesSourceOptions } from './sources/valuesSource';
export { selectionSource, type SelectionSource, type SelectionSourceInput } from './sources/selectionSource';
