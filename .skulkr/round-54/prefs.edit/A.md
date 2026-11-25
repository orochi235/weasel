# Audit round 54 — prefs.edit findings

## Moving a section between `object` leaves (or into/out of one) leaves every condition, alias and pair that read its leaves pointing at the old value paths
- where: packages/prefs/src/edit/valuePaths.ts:53 (valueMove), used by schemaEdit.ts:123 (moveNodes)
- scenario: group root with `object` leaves `a` and `b`; `a` holds section `s` holding leaf `x` (value path `a.x`); another leaf has `showIf: { path: 'a.x', is: true }` and an alias has `of: 'a.x'`. Move `a/s` under `b` (fitsUnder allows a section under an object leaf). `x` now lives at `b.x`, but `valueMove` returns `null` for any section, so `rebaseValuePaths` gets no move and the condition and alias still read `a.x`, which nothing holds. The same happens moving a section out of an object leaf to a section root's top level, or into one. A section's key is no part of a value path, but the path above it is; valueMove should yield a move for each value path under the section (as `valuePathsAt` already enumerates) whenever that prefix changes.
- evidence: read
- severity: medium
- note: in an asset set it is worse than a stale path. `moveInAsset` passes the same `null` moves to `editAsset`, whose `following` then removes every layout pointer to a leaf under the moved section (assetSetEdit.ts:21–25), because its old value path is gone and no move covers it.

## Converting a leaf that carries its own enum options to `enum` drops its default and keeps the blank's `'a'`, which is not one of the options kept
- where: packages/prefs/src/edit/kindSchemas.ts:293 (convertLeaf / carriesDefault)
- scenario: a leaf made from a registered enum type (options `light`/`dark`, default `'dark'`), or a custom kind holding `options`, is changed to plain `enum`. `options` is in KIND_ATTRS.enum and its attr kind is `enum-options`, so `offers` passes and the leaf's options replace the blank's. But `carriesDefault(v, blank)` checks the default against `blank.options` (`[{ value: 'a' }]`), so `'dark'` is dropped and reported in `dropped`, and the result keeps `default: 'a'` from the blank: an enum whose default is none of its options. The check should be against the options the result ends up holding.
- evidence: read
- severity: medium

## Two bundles of one package whose ids differ only in punctuation collapse into one group, the first silently lost
- where: packages/prefs/src/edit/bundleTree.ts:112 (bundleTree)
- scenario: presets in one package with ids `editing:shapes` and `editing.shapes` (or `editing-shapes`). `bundleKey` (actionLeafKey) maps both to `editingShapes`, and `setOwn(kids, bundleKey(d.id), …)` takes no `uniqueKey`, so the second overwrites the first; the Bundles tree never shows the first bundle and `pathOf` sends every link to either to the survivor. Atoms in the same loop already go through `uniqueKey`; bundles should too, with `pathOf` reading the key actually given.
- evidence: read
- severity: low

## A draft whose schema holds a plain-data value with a `$from`, `$num`, `$stub`, `$type` or `$unset` key is misread on reopen
- where: packages/prefs/src/edit/draft.ts:170 (unpack), packed by pack at :98
- scenario: a `map` leaf whose default is `{ $type: 'x', a: 1 }`, or any plain object value with one of those keys (user-keyed tables are exactly what a map's default is). `pack` writes plain objects unescaped, so on `openDraft` `unpack` treats the object as a marker: `$type` turns the default into a leaf-shaped record (`name`, `description`, `default`, `type`), `$unset`/`$type` keys are dropped, and `$from` with a non-array value throws in the destructure at :176 — outside `unpackSteps`' try when there are no steps (`unpackDraft` at :250), so opening the editor throws. Packing should escape an own key that collides with a marker.
- evidence: read
- severity: low

## A dotted leaf key under a section root may name a path beneath another leaf's value
- where: packages/prefs/src/edit/schemaKeys.ts:44 (keyProblem), also keyClashes at :93
- scenario: under a section root a number leaf keyed `grid`, then a new leaf keyed `grid.size` (dotted keys are allowed there). `keyProblem` checks only an exact own key, so it accepts it, and `keyClashes` reports nothing; the two leaves now store one value inside the other (`grid` a number and `grid.size` beneath it), and writing either clobbers the other. A key that is a prefix-path of, or extends, a taken leaf key should be refused the same way an equal one is.
- evidence: read
- severity: low

## A bundle link moved from one bundle to another exports as `{ op: 'move', kind: 'bundle' }`, the same shape as a bundle moved between packages, and `touched` reads its bundle ids as package names
- where: packages/prefs/src/edit/bundleExport.ts:93 (bundleChanges) and :107–111 (touched); type at :11–12
- scenario: bundle `B` (package `p`) is linked inside bundle `A1`; the reader drags the link into bundle `A2` (both in package `q`). `memberOf` gives the link `kind: 'bundle'`, so line 93 pushes `{ op: 'move', kind: 'bundle', id: 'B', from: 'A1', to: 'A2' }`. That is the shape line 68 uses for moving bundle `B` from one package to another, with `from`/`to` as package names, so an agent applying the document cannot tell the two apart. `touched` then takes `[c.id]` (package `p`) and adds `'A1'`/`'A2'` as package names, which match nothing, so package `q`, whose two bundles changed, is left out of `bundles`. A member move needs its own op or field, and `touched` should look up `from`/`to` as bundles for it.
- evidence: read
- severity: medium

## Reopening an asset-set draft that stands at the baseline throws away its redo steps; a lone schema's draft keeps them
- where: packages/prefs/src/edit/assetSetCodec.ts:93 (assetSetCodec.openDraft)
- scenario: the reader edits a dialog, undoes back to the baseline, and reloads. `saveDraft` still writes the asset, because the redo stack's sets differ from the source (:117). On open, `value === base`, so the draft is dropped and `null` returned, and the redo steps are gone. The same sequence under `schemaCodec` keeps them: `draft.ts` openDraft drops a draft only when its source moved (:243). So the codecs answer one question two ways, and `oneAssetCodec` gives a different result for one schema depending on whether a catalog is kept.
- evidence: read
- severity: low

## `attributeSchema` looks a group's `as` up in a plain object, so an `as` naming an `Object.prototype` member throws
- where: packages/prefs/src/edit/kindSchemas.ts:182 (attributeSchema)
- scenario: a hand-written or stored schema has a group with `as: 'toString'` (or `constructor`, `valueOf`). `AS_ATTRS[node.as ?? '']` returns the inherited function, so `?? []` does not apply and `[attr, ...fn]` throws `TypeError: … is not iterable`, and the attribute form for that group crashes rather than showing an unknown `as`. The lookup should go through `getOwn`, as every other user-keyed table here does.
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

<!-- done: 9 findings, files read: 44 -->
