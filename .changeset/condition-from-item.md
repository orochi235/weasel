---
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

A test may read from the entry its field sits in. `{ from: 'item', path: 'mode' }` on a field of a list's or a map's item reads `mode` from the same entry, where a test without `from` reads the schema root. Inside a list within a list it is the nearest entry, an item's own `enableIf` may read its entry, and an empty path is the entry itself. `PrefsForm`, `SelectionPanel`, `Bar`, and the dialog a labkit `ControlPanel` row opens each hide and disable a field entry by entry.

Adds API to `@weasel-js/prefs`:

- `PrefTest` takes `from: 'item'`, and `PrefConditionReader` is the reader `prefConditionHolds` asks, told where each path is read from.
- `applyPrefConditions` and `prefScopeAt` have no entry to read, so inside an item they leave a condition that reads the entry holding. `applyPrefEntryConditions(item, path, holds)` answers those for one entry and returns the item as that entry draws it with the paths it disables. `prefJudge` takes a third argument, the `PrefEntry` to read.
- `checkPrefCondition` holds a path read from the entry to the item of `site.within`, and reports the new code `no-item` for one on a node that is in no list or map.
- `prefConditionPaths(condition, 'item')` lists the paths read from the entry, and without the argument lists only those read from the root, which is a change for a condition that has both. `mapPrefConditionPaths` tells its callback where each path is read from. `prefConditionReadsItem` says whether a condition reads the entry at all.

Adds API to `@weasel-js/ui`: `PrefRenderContext` and `PropertyRenderContext` gain `entryAt`, which a custom renderer that draws its own entries calls for each; `PrefControl` takes `entryAt`; `entryApplier` makes one from a judge. `PrefConditionEditor` takes `entryOf`, the list or map whose entry the condition's node is drawn in, and then offers that entry's own fields first, each named as the entry's ("this Phase: mode"). `PrefSchemaEditor` offers "Enabled if" on a list's or a map's entry, with those fields to pick from, and no "Shown if" there. labkit's `conditionedLeaf` returns `entryAt` as well.

Breaking for a caller of `prefShownReader`, whose returned reader and `read` argument are now `PrefConditionReader`s, and of `conditionedSections`, which returns `entryAt` beside what it returned.
