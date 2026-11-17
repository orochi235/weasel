/**
 * @weasel-js/prefs-schema — the declaration half of `@weasel-js/prefs`: the `pref` builders, the leaf, group
 * and section types, units, conditions and the status they give a leaf, and repairing a stored value
 * against a leaf. No store, no storage, no React. `@weasel-js/prefs` re-exports all of it.
 *
 * @packageDocumentation
 */
export {
  filterPrefSubtree,
  flattenPrefValues,
  isPrefLeaf,
  isPrefSection,
  nestPrefValues,
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
  isPrefScope,
  scopeSelectors as prefScopeSelectors,
  memberAt as prefScopeValue,
  overrideOptions as prefOverrideOptions,
  scopeOptionValue as prefScopeOptionValue,
  PREF_ELSE,
  type PrefScope,
  type PrefSelection,
  type PrefOverrides,
  type PrefOverridesLookup,
  type PrefWeighted,
  type PrefWeights,
} from './scope';
export { prefOverridesOf, prefScopedDefault, prefScopesOf, type PrefScopeSpec } from './scopeSpec';
export { pref, type PrefLeafRest } from './build';
export { prefSchemaHolding } from './holding';
export { prefAliasedLeaf, prefAliasName, prefAliasTarget, type PrefAlias } from './alias';
export type { PrefLabel, PrefSeparator } from './label';
export { prefObjectBase, prefObjectField, prefObjectWithField } from './object';
export type { PrefList, PrefListControl } from './list';
export type { PrefMap } from './map';
export { prefVariantDefault, prefVariantOf, type PrefUnion } from './union';
export { prefAsBox, prefGroupIsPage } from './groups';
export type { PrefBarLead, PrefBarOverflow, PrefGroup, PrefGroupAs, PrefSection, PrefSectionAs } from './groups';
export { repairPrefValue, type PrefValidator } from './repair';
export {
  isPrefLinearUnit,
  prefUnit,
  PX_UNIT,
  prefUnitAccepts,
  resolvePrefUnit,
  type PrefFunctionUnit,
  type PrefLinearUnit,
  type PrefNumberUnit,
  type PrefUnitText,
  type ResolvedPrefUnit,
} from './unit';
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
export type { PresetDescription } from './presets';
export type {
  PrefAtPath, PrefFieldsOf, PrefGroupAt, PrefGroupPath, PrefPath, PrefValueAt, PrefValueOf, PrefValuesOf,
} from './paths';
