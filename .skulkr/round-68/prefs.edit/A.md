# Findings: prefs.edit (round 68)

## bundleProblems marks a leaf "named twice" in a bundle that is never loaded with the other namer
- where: packages/prefs/src/edit/bundleChecks.ts:104 (bundleProblems)
- scenario: bundles X and Y each name action `a`, bundle Z includes X and Y, and an unrelated bundle W also names `a` and is included by nothing. `said` records `a` once ("X and Y both name it, and Z loads them together"), and the final loop marks every leaf whose member key is in `said`, so W's `a` row is marked too, with a sentence about X and Y. The doc says a leaf is marked "where some bundle loads both"; no bundle loads W with X or Y. The loop should only mark leaves whose bundle (or atom) is among the holders that clash for that name.
- evidence: read
- severity: medium

## copyNodes picks a copied leaf's key with uniqueKey where shiftNodes uses uniqueLeafKey, so a copy can take a key nested in another leaf's value path
- where: packages/prefs/src/edit/schemaCopy.ts:94 (copyNodes, leafKey); also schemaCopy.ts:59 (aliasNodes)
- scenario: under a section root (or inside an `object` leaf), a value leaf is keyed `a.b`. Copy a leaf keyed `a` that is not turned into an alias (a leaf that holds no value, e.g. an action, or a field of an `object` leaf, where `canAlias` is false) into that scope. `uniqueKey(leafKeys, 'a')` returns `a`, since no sibling is literally keyed `a`, and the copy lands at a key whose value would hold `a.b`'s: the clash `keyProblem` refuses (`nested`) and `keyClashes` then reports. `shiftNodes` answers the same question with `uniqueLeafKey`, which numbers the key (`a2`). One question, two answers; the copy should use `uniqueLeafKey` too (and `aliasNodes` likewise).
- evidence: read
- severity: medium

## Copying or moving a section re-keys only the section, so the leaves inside it can share a value path with leaves already in the target scope
- where: packages/prefs/src/edit/schemaCopy.ts:104 (copyNodes, copyOf for a branch when `aliasing` is false); packages/prefs/src/edit/schemaEdit.ts:154 (shiftNodes)
- scenario: under a group root, an `object` leaf `frame` holds a section `edge` with field `width`. Copy `frame/edge` into `frame` itself. `aliasing` is false (the root is not a section), so `copyOf` returns the section unchanged under `edge2`, and `frame` now holds two `width` leaves at one value path (a section's key is no part of a value path). `keysTakenAt` and `keyClashes` treat that as a clash, and `keyClashes` says "No edit here makes one". The same happens when `shiftNodes` moves a section into a different scope (from one `object` leaf to another, or from a section root's level into an `object` leaf): only the top key goes through `uniqueKey`, and the leaves inside it are not checked against the scope they join. The section-root case is handled by turning value leaves into aliases; inside an `object` leaf nothing is.
- evidence: read
- severity: medium

## aliasesTo keys a layout alias with a section root's dotted leaf key, which copyNodes rewrites with `_` instead
- where: packages/prefs/src/edit/settingAliases.ts:28 and :32 (aliasesTo)
- scenario: a dialog that is a section root holds a leaf keyed `frame.edge` (under a section root a key is the value's path and may be dotted). Dragging it into a layout (a group root) offers `key: 'frame.edge'`, and a group's child key may not hold a `.` (`takesDottedKey` is false there, so `checkKey` refuses it as invalid). The same situation in `schemaCopy.aliasKey` is answered by `key.replaceAll('.', '_')`; here the dotted key is passed through. Inferred from the key rules; the caller in prefs-editor's SettingsTree passes `made.key` on unchanged.
- evidence: read (caller behavior inferred)
- severity: low

## withRoots treats a step's asset as unchanged by the host while ignoring presets and nodeKind
- where: packages/prefs/src/edit/assetSet.ts:129 (withRoots, said)
- scenario: the host replaces a Bundles asset's `presets` (or a schema asset's `nodeKind`) while keeping its label, lock and kind. An undo step then finds `said(was, asset)` true and returns `was` whole, which restores the old `presets`/`nodeKind` along with the root. The doc says what a host has said of an asset since is not the step's to take back; only label, kind, readOnly and over are compared. Should compare every non-root field, or always return `{ ...asset, root: was.root }`.
- evidence: read
- severity: low

## printValue prints a `__proto__` key bare, so the exported literal sets a prototype instead of holding the key
- where: packages/prefs/src/edit/schemaExport.ts:33 (printKey), used by printValue/printInline
- scenario: a map pref whose default (or any other plain-object attribute value) holds the own key `__proto__` prints as `{ __proto__: … }`. In an object literal that sets the object's prototype instead of creating an own key, so the pasted export silently loses the entry. `isValidKey('__proto__')` is true, so it is not quoted (and quoting would not help; it needs a computed `['__proto__']`). Node keys are protected by `keyProblem`; attribute values are not.
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
