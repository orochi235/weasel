# Audit round 54, `prefs-editor.PrefSchemaEditor.part2` — blind review

## Enum options and pair editors draw a mixed value as empty, so one edit wipes every selected node's list
- where: packages/prefs-editor/src/PrefSchemaEditor/attrRenderers.tsx:34 (EnumOptions), :65 (PairEditor)
- scenario: select two `enum` leaves with different `options` (or two leaves with different `pair`s). The
  attributes form marks `$own.options` mixed (`mixedRowsFor`), and `PrefsRow` hands the renderer `value: undefined`,
  `mixed: true`. `EnumOptions` ignores `ctx.mixed` and reads `undefined` as `[]`, so it shows an empty
  "Add option…" field. Typing one option calls `setValue([{ value, label }])`, which replaces both leaves' option
  lists with that single option. `PairEditor` does the same: it shows no partners, and picking one in "Add field…"
  overwrites both pairings. Expected: a mixed state like the other renderers in this file (`OptionalNumber`, `symbol`,
  `icon` all pass `mixed`) or like the kit's own list leaf (`renderLeaf.tsx:86`), not a blank list that reads as
  "none" and whose first edit throws away every node's list.
- evidence: read (attrRenderers.tsx; ui/Prefs/PrefsRow.tsx:134-149 sets value undefined when mixed; attributeForm.ts:86 marks `$own.<k>` mixed)
- severity: medium

## A tree drag moved from the preview onto the unplaced list leaves the preview's drop drawn and its rail timer running
- where: packages/prefs-editor/src/PrefSchemaEditor/useTreeDragOut.ts:38 (onDragOutside)
- scenario: drag a structure-tree row out over the live preview so `outside.over` draws a drop (or rests on a rail
  entry, which arms the 500 ms `RAIL_OPEN_MS` timer in `usePreviewDropZone`), then carry it onto the unplaced list.
  There `off` is true and the function returns before calling `outside.over` or `outside.end`. The Tree still
  counts the drag as taken outside (`useTreeDrag.ts:168-170`), so it never calls `leaveOutside` either. The preview
  keeps drawing the stale placeholder while the pointer is over the unplaced list. If the drag passed a rail entry,
  the timer still fires and `onOpen` switches the selection to that page's group although the pointer has left the
  preview. Expected: `outside.end()` once the drag is over the unplaced list, as happens when it goes back into the
  tree.
- evidence: read (useTreeDragOut.ts; ui/Tree/useTreeDrag.ts:131-136,164-170; usePreviewDropZone.ts:54-68)
- severity: medium

## `useAssetChanges` returns the host's `report` result from an effect, which React then calls as a cleanup
- where: packages/prefs-editor/src/PrefSchemaEditor/useAssetChanges.ts:81
- scenario: `useEffect(() => reported.current?.(ids), …)` has a concise arrow body, so whatever `report` returns
  becomes the effect's return value. `report` is typed `(ids) => void`, which TypeScript lets a value-returning
  function satisfy, e.g. a host's `report={(ids) => (changedRef.current = ids)}` or `(ids) => store.set(ids)`. React
  then logs an error in dev, and on the next change or on unmount it calls the returned Set as a destroy function.
  That throws `TypeError: destroy is not a function` into the nearest error boundary. Expected: a block body that
  discards the return value.
- evidence: read
- severity: low

## `heirAfter` gives no heir when a removed node sits inside a folded branch, so Delete clears the selection
- where: packages/prefs-editor/src/PrefSchemaEditor/heirAfter.ts:8-18 (heirAfter)
- scenario: select a leaf, fold its parent group in the structure tree (the selection stays, since `livePaths` only
  drops paths that no longer exist), then press Delete. `walk` does not descend into the folded group, so no row in
  `rows` is or lies under the removed path, `first` is `undefined`, and the function returns `null`. `remove`
  (assetEdits.ts:95) then selects nothing, although plenty of rows remain, including the folded parent that holds
  the next sibling. The doc says `null` means "nothing is left". Expected: an heir among the drawn rows, such as
  the folded ancestor or its neighbor.
- evidence: read
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

<!-- done: 4 findings, files read: 36 -->
