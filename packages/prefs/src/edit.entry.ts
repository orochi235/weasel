/**
 * @weasel-js/prefs/edit — the model behind a schema editor, with no React and no DOM: edits to a preferences
 * schema's tree (add, move, rename, copy, alias), its keys and value paths, a leaf's kind and attributes, printing a
 * schema and diffing two, a workspace of schema, layout, actions, and bundle assets and its codec, drafts and their
 * history, and a condition's rows and flow. `@weasel-js/prefs-editor` draws an editor over it.
 *
 * @packageDocumentation
 */
export { actionCatalog, dissolve, filed, firedBy, keyTails, NO_CATALOG } from './edit/actionCatalog';
export { actionLeaf, actionLeafKey, deadActionPaths, type SchemaAction } from './edit/actionLeaves';
export { exportOf, type AssetExport } from './edit/assetExport';
export { pathsIn, scopedPath } from './edit/assetScope';
export { aggregateAttributes, catalogAttributes, isObjectField, setAutoRow, setObjectField } from './edit/attrAggregate';
export { type AutoRow } from './edit/autoRows';
export { bundleLoads, bundleProblems, type BundleProblem } from './edit/bundleChecks';
export { bundleChanges, bundlesDocument, presetsHash, type BundleChange, type BundlesDocument } from './edit/bundleExport';
export {
  BUNDLE_KINDS, BUNDLE_LINKS, bundleIdOf, bundleParts, bundleTree, isAtomLeaf, isBundleAt, memberKey, memberOf,
  membership, readBundles, type Bundle, type BundleMember,
} from './edit/bundleTree';
export {
  CONDITION_FLOW_END, CONDITION_FLOW_START, prefConditionFlow, type ConditionFlow, type ConditionFlowEdge,
  type ConditionFlowGroup, type ConditionFlowNode, type ConditionFlowOptions,
} from './edit/conditionFlow';
export {
  EMPTY_HOLDS, groupCondition, groupOf, nestedQuantifier, QUANTIFIER_LABEL, rootCondition, rootGroup, rowCondition,
  testRowOf, type ConditionGroup, type Quantifier, type TestRow,
} from './edit/conditionGroups';
export { conditionLeafOf, conditionLeaves, leafKey, type ConditionLeaf } from './edit/conditionLeaves';
export { conditionProblems } from './edit/conditionMarks';
export {
  clauseChoices, clausesOf, COMPARISON_LABEL, comparisonsFor, openBound, operatorOf, printOperators, rowAt,
  withBound, withComparison, withoutClause, withValue, type Comparison,
} from './edit/conditionRows';
export { SWAP, swapOp, type DocumentCodec, type DraftStorage, type OpenedDocument } from './edit/document';
export { draftChangedAssets } from './edit/draftChangedAssets';
export { foldablePaths, foldsUnder, openAfterStep } from './edit/folds';
export { CONDITION_KIND, type CustomKinds, type KindAttr, type KindAttrs } from './edit/kindAttrTable';
export {
  attributeSchema, blankGroup, blankLeaf, blankSection, BUILTIN_KINDS, changeKind, convertLeaf, entryOf, leafOf,
  normalizeAttr,
} from './edit/kindSchemas';
export {
  holdsPages, isLoose, looseKeys, looseTarget, mayUnplace, placedOnly, schemaTarget, topLevelAllows,
} from './edit/loose';
export { trackOrigins } from './edit/nodeOrigins';
export { asWorkspace, catalogIn, ONE, oneAssetCodec, sameSchema, schemaOf } from './edit/oneAsset';
export { deadPointers, drawnLeaf, pointerAttributes, pointerTarget } from './edit/pointers';
export { type PresetDescription } from './edit/presets';
export { schemaCodec } from './edit/schemaCodec';
export { aliasNodes, aliasOf, canAlias, copyNodes, VALUE_LINKS, type LinkRule } from './edit/schemaCopy';
export {
  addNode, carried, moveNodes, rebasePaths, removeNode, removeNodes, renameKey, replaceNode, setAttribute,
} from './edit/schemaEdit';
export {
  baselinePaths, changedAttributes, changedPaths, containsCode, diffSchemas, formatChanges, KEEP, printSchema,
  printValue, STUB, type SchemaChange,
} from './edit/schemaExport';
export { keyClashes, keyFromName, keyProblem, keysTakenAt, takesDottedKey, uniqueKey } from './edit/schemaKeys';
export {
  branchUnder, childrenOf, entryHolderAt, fitsUnder, isUnder, joinPath, keyOf, keysOf, nodeAt, ownChildrenOf,
  parentPath, pathOf, withinDepth, type ChildMap, type SchemaNode, type SchemaRoot, type SchemaTarget,
} from './edit/schemaTree';
export { pointable, pointedAt, pointersTo } from './edit/settingPointers';
export { choiceOf, entryChoices, kindChoices, NO_TYPES, typeNamed, type KindChoice, type PrefTypes } from './edit/types';
export { stillUnplaced, unplacedAt } from './edit/unplaced';
export { valuePathOf, valuePathsAt } from './edit/valuePaths';
export {
  assetOf, bundlesAsset, catalogOf, headingOf, isShown, overOf, sameRoots, shownAssets, withRoots, type ActionsAsset,
  type Asset, type AssetHeading, type BundlesAsset, type LayoutAsset, type ListedAsset, type SchemaAsset,
  type ShownAsset, type Workspace,
} from './edit/workspace';
export { changedAsset, workspaceChanges, type AssetChanges } from './edit/workspaceChanges';
export { workspaceCodec } from './edit/workspaceCodec';
export { editAsset, moveInAsset, NO_MOVES, removeInAsset, renameInAsset } from './edit/workspaceEdit';
