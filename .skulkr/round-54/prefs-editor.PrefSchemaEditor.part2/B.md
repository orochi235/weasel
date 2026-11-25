## "Add pref" with nothing selected puts the new leaf loose at a page-holding root, where every drop path refuses a loose node
- where: packages/prefs-editor/src/PrefSchemaEditor/useNodeAdder.ts:11 (addTargetOf), :41 (add)
- scenario: A group-rooted schema that holds pages (not `pageless`, not a bar/menu root), nothing selected (`lead === null`). StructurePane enables "Add pref" (`onAddPref` is null only for `readOnly || pageless`). `addTargetOf` returns `{ parent: null }`, so `add` does `addNode(schema, null, key, leaf)` and the leaf lands directly under the root. There it is loose: it leaves the structure tree, shows up only in the Unplaced list, and the row `onSelect` picks is one the tree does not draw. The editor rules on this placement the other way everywhere else: `treeTakesNew` (previewDrop.ts:87) returns `!isLoose(node)` for a new node at the root, `topLevelAllows` refuses a loose node there for a tree move, and `previewTarget` (previewDrop.ts:32) refuses one at the root. The adder should either refuse (disable Add pref with no group lead under a page-holding root) or follow the same rule. Every Add pref test selects a group first, so none covers this.
- evidence: read (useNodeAdder.ts, StructurePane.tsx:159, previewDrop.ts, prefs/src/edit/loose.ts)
- severity: medium

## A tree drag moved onto the Unplaced list never tells the preview it left, so the preview's drop stays drawn
- where: packages/prefs-editor/src/PrefSchemaEditor/useTreeDragOut.ts:38 (onDragOutside)
- scenario: A structure-tree row is dragged over the live preview (`outside.over` sets a drop and may start the rail-open timer), then onto the Unplaced list. There `off` is true and the function returns before calling `outside.over` or `outside.end`, and the Tree records the drag as taken outside, so `leaveOutside` never runs either. While the pointer is over the Unplaced list, the preview keeps drawing the last drop mark or held placeholder it had. Only the drag's final reset clears it. The same happens when `canLand` turns false mid-drag (for example, a key change to `link` on a node with no alias): line 39 returns false without `outside.end()`, so the previous mark stays until the Tree's `leaveOutside` fires. Going onto the Unplaced list should call `outside.end()`.
- evidence: read (useTreeDragOut.ts, ui/src/components/Tree/useTreeDrag.ts:164-201, usePreviewDropZone.ts)
- severity: low

## useAssetChanges hands the host's `onChangedAssets` return value back to React as an effect cleanup
- where: packages/prefs-editor/src/PrefSchemaEditor/useAssetChanges.ts:81
- scenario: `useEffect(() => reported.current?.(ids), [ids, reported])` is an expression-bodied arrow, so the effect returns whatever the host's callback returns. `onChangedAssets` is typed `(ids) => void`, which TypeScript lets a function returning a value satisfy. A host writing `onChangedAssets={(ids) => seen.add(...)}` (a Set) or `(ids) => list.push(...)` (a number) makes React treat that value as the effect's destroy function. React logs "An effect function must not return anything besides a function" on every change. A host that returns a function (for example, a memoized `() => unsubscribe`) gets it called on the next change as if it were a cleanup. Use a block body.
- evidence: read (useAssetChanges.ts, AssetEditor.tsx:79,142)
- severity: low

## Files read
packages/prefs-editor/src/PrefSchemaEditor/UnplacedTree.tsx
packages/prefs-editor/src/PrefSchemaEditor/aliasChoices.ts
packages/prefs-editor/src/PrefSchemaEditor/assetEdits.ts
packages/prefs-editor/src/PrefSchemaEditor/attrRenderers.tsx
packages/prefs-editor/src/PrefSchemaEditor/attributeForm.ts
packages/prefs-editor/src/PrefSchemaEditor/attributeKey.ts
packages/prefs-editor/src/PrefSchemaEditor/attributeRenderers.tsx
packages/prefs-editor/src/PrefSchemaEditor/autoValueRenderer.tsx
packages/prefs-editor/src/PrefSchemaEditor/defaults.ts
packages/prefs-editor/src/PrefSchemaEditor/editorActions.ts
packages/prefs-editor/src/PrefSchemaEditor/editorPrefs.tsx
packages/prefs-editor/src/PrefSchemaEditor/heirAfter.ts
packages/prefs-editor/src/PrefSchemaEditor/iconPickerModel.ts
packages/prefs-editor/src/PrefSchemaEditor/nodeIcon.tsx
packages/prefs-editor/src/PrefSchemaEditor/paneWidths.ts
packages/prefs-editor/src/PrefSchemaEditor/panelPaths.ts
packages/prefs-editor/src/PrefSchemaEditor/pointerDrag.fixture.ts
packages/prefs-editor/src/PrefSchemaEditor/previewDrop.ts
packages/prefs-editor/src/PrefSchemaEditor/rowSearch.ts
packages/prefs-editor/src/PrefSchemaEditor/structureRows.tsx
packages/prefs-editor/src/PrefSchemaEditor/treeDropRules.ts
packages/prefs-editor/src/PrefSchemaEditor/treeRows.fixture.ts
packages/prefs-editor/src/PrefSchemaEditor/useActionCatalog.ts
packages/prefs-editor/src/PrefSchemaEditor/useAssetChanges.ts
packages/prefs-editor/src/PrefSchemaEditor/useAssetView.ts
packages/prefs-editor/src/PrefSchemaEditor/useBundleView.tsx
packages/prefs-editor/src/PrefSchemaEditor/useDocument.ts
packages/prefs-editor/src/PrefSchemaEditor/useEditorSelection.ts
packages/prefs-editor/src/PrefSchemaEditor/useHeldPlace.ts
packages/prefs-editor/src/PrefSchemaEditor/useNodeAdder.ts
packages/prefs-editor/src/PrefSchemaEditor/usePaletteDrop.ts
packages/prefs-editor/src/PrefSchemaEditor/usePreviewDrag.ts
packages/prefs-editor/src/PrefSchemaEditor/usePreviewDropZone.ts
packages/prefs-editor/src/PrefSchemaEditor/useRowMarks.tsx
packages/prefs-editor/src/PrefSchemaEditor/useSelectedNodes.ts
packages/prefs-editor/src/PrefSchemaEditor/useTreeDragOut.ts

<!-- done: 3 findings, files read: 36 -->
