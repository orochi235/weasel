# prefs-schema: blind review findings

## repairPrefValue throws on a `list` or `map` leaf that holds no `item`, which status.ts says an app's leaf may do
- where: packages/prefs-schema/src/repair.ts:118 (repairMap), packages/prefs-schema/src/repair.ts:133 (repairList)
- scenario: an app draws its own leaf under the built-in kind `list` (or `map`) with no `item`. status.ts:117 handles exactly this ("A leaf an app's renderer draws under a built-in's kind may hold no item"), and so do judge.ts `entryAt`, helpers.ts `visibleInside` and statusAt.ts `statusInside`. When a non-empty array (or object) is stored for that leaf, `repairList` maps each entry through `repairPrefValue(leaf.item, …)` with `leaf.item === undefined`. `leaf.kind` then throws a TypeError, so reading the stored value fails. It should pass the entries through unrepaired, or treat the leaf as an app-defined kind.
- evidence: read
- severity: medium
- fix: packages/prefs-schema/src/repair.ts
- size: line
- cause: missing `item === undefined` guard, answered differently from the other walks
- confidence: likely

## A condition naming a field of a list or map entry by its root path compares the stored form, not the shown form
- where: packages/prefs-schema/src/holding.ts:68 (insideLeaf), packages/prefs-schema/src/shown.ts:37 (prefShownReader)
- scenario: take a list `phases` whose `item` is an object with a boolean field `italic` that has an `encoding` (it stores `'italic'`), and a test `{ path: 'phases.0.italic', is: true }`. `prefReader` (judge.ts `fieldValue` → `entryAt` → `entryValue`) follows the list's `item` and returns the field's stored value `'italic'`. `prefShownReader` asks `prefLeavesHolding`, whose `insideLeaf` answers `UNSEEN` for any list or map, so nothing is decoded. The test compares `'italic'` with `true` and never holds. The same test made from inside the entry (`from: 'item'`, path `italic`) is decoded through `prefLeavesHoldingIn(item, …)` and does hold. So the question "which leaf describes `phases.0.italic`" gets one answer from the reader and another from the decoder.
- evidence: read
- severity: low
- fix: packages/prefs-schema/src/holding.ts
- size: function
- cause: `insideLeaf` does not descend into a list's or map's `item`, though the reader does
- confidence: likely

## Files read
packages/prefs-schema/src/action.ts
packages/prefs-schema/src/alias.ts
packages/prefs-schema/src/bounds.ts
packages/prefs-schema/src/build.ts
packages/prefs-schema/src/condition.ts
packages/prefs-schema/src/groupConditions.ts
packages/prefs-schema/src/groups.ts
packages/prefs-schema/src/helpers.ts
packages/prefs-schema/src/holding.ts
packages/prefs-schema/src/index.ts
packages/prefs-schema/src/internal.ts
packages/prefs-schema/src/judge.ts
packages/prefs-schema/src/label.ts
packages/prefs-schema/src/leafValue.ts
packages/prefs-schema/src/list.ts
packages/prefs-schema/src/map.ts
packages/prefs-schema/src/number.ts
packages/prefs-schema/src/object.ts
packages/prefs-schema/src/paths.ts
packages/prefs-schema/src/presets.ts
packages/prefs-schema/src/repair.ts
packages/prefs-schema/src/schema.ts
packages/prefs-schema/src/schemaIcon.typetest.ts
packages/prefs-schema/src/scope.ts
packages/prefs-schema/src/scopeSpec.ts
packages/prefs-schema/src/shown.ts
packages/prefs-schema/src/status.ts
packages/prefs-schema/src/statusAt.ts
packages/prefs-schema/src/testing/pbt.fixture.ts
packages/prefs-schema/src/union.ts
packages/prefs-schema/src/unit.ts

<!-- done: 2 findings, files read: 31 -->
