/**
 * @weasel-js/prefs-schema/internal — the schema helpers `@weasel-js/prefs` builds its store and edit
 * model on, and no consumer should. Not public API: it changes without notice.
 *
 * @packageDocumentation
 */
export { formOf, ORDERINGS, partsOf, type Form } from './condition';
export { assignPrefValueAt, setOwnPrefValue } from './helpers';
export { prefLeavesHolding, prefLeavesHoldingIn, UNSEEN, type PrefLeavesFound, type PrefHeld, type PrefHeldVariant } from './holding';
export {
  dropUnlisted,
  mapScopeValues,
  overrideOptions,
  repairScope,
  scopeOptionValue,
  scopeSelectors,
  selectionWeights,
  upgradeScope,
  weighScope,
  writeDeclared,
} from './scope';
export { overridesOfPref, scopeSelectorsOf } from './scopeSpec';
