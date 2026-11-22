# Findings: prefs.edit (round 68)

## A draft stores a list's or a map's object entry's fields as a pointer to the source's fields whenever one of them holds code, so every edit to those fields is lost on reopen
- where: packages/prefs/src/edit/draft.ts:119-123 (packAttrs → attr('children') → pack:103-107), with codeOrigins:87-91
- scenario: a `list` whose `item` is an open `object` leaf, one of whose fields holds a function (a `run`, a `validate`, a computed `options`). The tree shows those fields as rows (`slotOf(list) === 'item'`), so the reader renames one, edits its name, or adds a field. `packNode(list)` finds no own slot (`ownChildrenOf` is `undefined` for an entry), so the fields are packed only as the entry's `children` attribute. `containsCode(childrenMap)` is true, so `pack` writes `{ $from: [listPath, 'item', 'children'] }`, and `codeOrigins` even registers the source's whole map under that origin. On reopen `unpack` returns the source's `item.children`, and the reader's field edits are gone. For a list the draft added itself the path names nothing, so `children` is dropped and the entry has no fields. An `object` leaf outside an entry does not lose them, because packNode:139 overwrites `children` with per-node packing. The entry's fields need the same handling.
- evidence: read (draft.ts, schemaTree.ts:32-56)
- severity: high

## aliasesTo keys a layout's alias by the dialog's raw key, which under a section-root dialog is a dotted value path no group key may be
- where: packages/prefs/src/edit/settingAliases.ts:28 and :32 (aliasesTo)
- scenario: a layout over a node-properties dialog (a `PrefSection` root, whose leaves `takesDottedKey` lets be keyed `stroke.width`). Dragging that setting from the Settings tree gives `{ key: 'stroke.width' }`; `usePaletteDrop` passes it through `uniqueKey` to `addNode` under a layout group, where `checkKey(..., dotted=false)` throws "not a valid key". Dragging the group instead builds a heading whose `children` are keyed `stroke.width` etc. directly (no `checkKey` runs on them), so the layout holds keys `keyProblem`/`isValidKey` reject and that export prints quoted. `schemaCopy.aliasKey` answers the same question ("an alias of a leaf whose key is a value path") by replacing `.` with `_`; `aliasesTo` does not.
- evidence: read (settingAliases.ts, schemaCopy.ts:36-38, schemaKeys.ts:63-70, prefs-editor usePaletteDrop.ts:50-51)
- severity: medium

## copyNodes and aliasNodes pick a leaf's key with uniqueKey, so a copy can land at a key holding a value inside or around a sibling's; shiftNodes uses uniqueLeafKey for exactly this
- where: packages/prefs/src/edit/schemaCopy.ts:59 (aliasNodes) and :94 (copyNodes leafKey)
- scenario: under a group root, an `object` leaf A holds a field keyed `stroke` (a string). Copy (or move-then-compare) a field keyed `stroke.width` from another object leaf into A. `uniqueKey(leafKeys, 'stroke.width')` returns `stroke.width`, since no key equals it, and the copy holds a value inside `stroke`'s. `keyProblem` would refuse that key ("would hold its value inside"), `keyClashes` then marks both rows, and the value written for one overwrites the other. `shiftNodes` (schemaEdit.ts:155) picks the same key with `uniqueLeafKey`, which skips it, so move and copy decide the free key two different ways.
- evidence: read (schemaCopy.ts, schemaEdit.ts:152-160, schemaKeys.ts:51-58, 63-76)
- severity: low

## withRoots hands back the stepped asset whole when label, kind, lock and `over` match, so an undo takes back a host's later change to `nodeKind` or a Bundles asset's `presets`
- where: packages/prefs/src/edit/assetSet.ts:129-133 (withRoots, `said`)
- scenario: a host re-supplies a schema asset with `nodeKind` set (or a bundles asset with new `presets`) after an edit was made. Undo calls `withRoots(current, stepped)`; `said(was, asset)` compares only label, kind, readOnly and `over`, finds them equal, and returns `was`, the asset as it was at the step, so the old `nodeKind` comes back (`headingOf` files it under Dialogs instead of Node properties) or the old `presets` (the parts list offers the old descriptions). The doc says what a host has said of an asset since is not the step's to take back. It should compare every non-root field, or always use `{ ...asset, root: was.root }`.
- evidence: read
- severity: low

## Selecting action prefs that fire different unregistered keys drops the Action row silently: it is neither shown as mixed nor listed in `apart`
- where: packages/prefs/src/edit/attrAggregate.ts:107 (aggregateAttributes `common`), with kindSchemas.ts:190 (attributeSchema → actionChoice)
- scenario: two action prefs, one firing a registered key and one firing `old.gone` (not registered), or two firing different unregistered keys. `attributeSchema` gives each its own `action` choice, and an unregistered held key is put first in `options`, so the two definitions differ. `common` then `continue`s at line 107 before the value comparison, so `action` is in neither `schema`, `mixed` nor `apart`. Where the definitions agree, a disagreeing value lands in `mixed` or `apart`. Here the form has no row for it and nothing saying it was left out.
- evidence: read (attrAggregate.ts:102-127, registeredActionAttrs.ts:20-24)
- severity: low

## printValue prints a data key `__proto__` bare, so the exported literal sets a prototype instead of holding the entry
- where: packages/prefs/src/edit/schemaExport.ts:33-35 (printKey), used by printValue:38/56
- scenario: a `map` pref whose default (or any plain-object attribute value) holds an entry keyed `__proto__`. Values read back from JSON or built with `Object.fromEntries` hold such a key as an own property. `isValidKey('__proto__')` is true, so the key prints as `__proto__: …`. In an object literal that syntax (and the quoted form too) sets `[[Prototype]]` rather than defining a property, so the pasted schema silently loses the entry. `keyProblem` refuses `__proto__` for node keys, but nothing guards attribute values. Printing it as `['__proto__']: …` keeps it.
- evidence: read
- severity: low

## Files read
packages/prefs/src/edit/actionCatalog.ts
packages/prefs/src/edit/actionLeaves.ts
packages/prefs/src/edit/aliases.ts
packages/prefs/src/edit/assetExport.ts
packages/prefs/src/edit/assetScope.ts
packages/prefs/src/edit/assetSet.ts
packages/prefs/src/edit/assetSetChanges.ts
packages/prefs/src/edit/assetSetCodec.ts
packages/prefs/src/edit/assetSetEdit.ts
packages/prefs/src/edit/attrAggregate.ts
packages/prefs/src/edit/autoRows.ts
packages/prefs/src/edit/bundleChecks.ts
packages/prefs/src/edit/bundleExport.ts
packages/prefs/src/edit/bundleTree.ts
packages/prefs/src/edit/carry.ts
packages/prefs/src/edit/conditionFlow.ts
packages/prefs/src/edit/conditionGroups.ts
packages/prefs/src/edit/conditionLeaves.ts
packages/prefs/src/edit/conditionMarks.ts
packages/prefs/src/edit/conditionRows.ts
packages/prefs/src/edit/document.ts
packages/prefs/src/edit/draft.ts
packages/prefs/src/edit/draftChangedAssets.ts
packages/prefs/src/edit/folds.ts
packages/prefs/src/edit/kindAttrTable.ts
packages/prefs/src/edit/kindSchemas.ts
packages/prefs/src/edit/layoutEdit.ts
packages/prefs/src/edit/loose.ts
packages/prefs/src/edit/nodeOrigins.ts
packages/prefs/src/edit/oneAsset.ts
packages/prefs/src/edit/registeredActionAttrs.ts
packages/prefs/src/edit/schemaCodec.ts
packages/prefs/src/edit/schemaCopy.ts
packages/prefs/src/edit/schemaEdit.ts
packages/prefs/src/edit/schemaExport.ts
packages/prefs/src/edit/schemaKeys.ts
packages/prefs/src/edit/schemaTree.ts
packages/prefs/src/edit/sent.ts
packages/prefs/src/edit/settingAliases.ts
packages/prefs/src/edit/swaps.ts
packages/prefs/src/edit/types.ts
packages/prefs/src/edit/unplaced.ts
packages/prefs/src/edit/upgrade.ts
packages/prefs/src/edit/valuePaths.ts

<!-- done: 6 findings, files read: 44 -->
