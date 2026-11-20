## An included bundle moved between bundles exports as a bundle changing package, and the packages of the bundles it moved between are left out
- where: packages/prefs/src/edit/bundleExport.ts:93 (bundleChanges), :107 and :111 (touched)
- scenario: bundle `c` is linked (included) in bundle `a`, and the reader drags that link into bundle `b`. `bundleChanges` pushes `{ op: 'move', kind: 'bundle', id: 'c', from: 'a', to: 'b' }`. Line 68 uses exactly that shape to say "bundle `c` moved from package `a` to package `b`", so whoever reads the `weasel-bundles/1` document cannot tell the two apart. `touched` then treats it as a package move. Line 107 skips it, because `c.kind !== 'bundle'` is false, and returns `[c.id]`, which is the package of the included bundle `c`. Line 111 then adds the bundle ids `a` and `b` as if they were package names. So the packages holding `a` and `b` are missing from `packages` unless another change touched them, and `bundlesDocument().bundles` leaves out the very bundles whose members changed. What should happen: a member move should look different from a bundle's package move, and `touched` should look up its `from` and `to` in `pkg`.
- evidence: read
- severity: medium

## `convertLeaf` drops `access` (and keeps `readout` and `auto`) by a different list than `sharedAttrs` offers
- where: packages/prefs/src/edit/kindSchemas.ts:258 (SHARED), :287 and :310 (convertLeaf)
- scenario: a `boolean` leaf with `access: 'b'` (a menu letter) is converted to `action`. Both kinds are in `LETTERED`, so `sharedAttrs` offers `access` on both. But `keep` is `SHARED` plus the target kind's `KIND_ATTRS`, and `SHARED` has no `access`, so the letter is dropped and listed in `dropped`. The same happens converting `alias` to `boolean`, or anything to `label`. In the other direction, `SHARED` keeps `readout` when converting to a kind that holds no value (`action`, `label`), and line 300 keeps `auto` (`can`/`on`) there too, though `sharedAttrs` and `autoAttrs` offer neither. Both then land in `readOnly` (line 202) and can no longer be edited or cleared. `USE_SITE` (line 79) lists `access` as a shared use-site field, so the same question gets two different answers in one file.
- evidence: read
- severity: low

## `conditionLeaves` and `conditionLeafOf` never resolve a test read from its group (`from: 'group'`)
- where: packages/prefs/src/edit/conditionLeaves.ts:22 and :31 (ConditionLeaf.from, conditionLeafOf)
- scenario: `packages/editor/src/usePageGrid.ts:13` has `showIf: { from: 'group', path: 'visible' }`. `ConditionLeaf.from` can only be `'item'`, and `conditionLeafOf` matches `l.from === test.from` exactly, so no leaf ever matches a group test. As a result, `prefConditionFlow` (conditionFlow.ts:52) draws the box as the raw `this group: visible` plus `printOperators`, without the leaf's name or its enum option labels. The condition editor's rows can't resolve or offer the group's leaves either. Meanwhile `conditionCheck` and `rebaseValuePaths` (valuePaths.ts:134) do resolve `from: 'group'`, which landed 2026-11-17 (4c8749c007) without reaching this module.
- evidence: read
- severity: low

## Clearing a field of an object attribute leaves an empty object behind instead of removing the attribute
- where: packages/prefs/src/edit/attrAggregate.ts:42 (withObjectField) and :58 (setObjectField)
- scenario: a node has no `frame` attribute. The reader sets `frame.edge` to 1, then clears it. `withObjectField({edge: 1}, ['edge'], undefined)` deletes `edge` and returns `{}`, and `setAttribute` writes `frame: {}`. It never gets `undefined`, which is what would remove the attribute. Clearing a nested field that was never set (`frame.a.b`) also builds `{ a: {} }`. The node now differs from its baseline (`diffSchemas` reports `frame: (unset) → {}`, and the asset shows as changed), and `printSchema` exports `frame: {}` although nothing is set. An object left with no fields should be removed (return `undefined`), and so should any intermediate object that ends up empty.
- evidence: read
- severity: low

## Draft packing does not escape its marker keys, so user data holding `$num`/`$stub`/`$from`/`$type` is misread on reload
- where: packages/prefs/src/edit/draft.ts:108 (pack) and :173–193 (unpack)
- scenario: a `map` pref's `default` (its keys are the user's) is `{ $type: 'x' }` or `{ $num: '1' }`. `pack` copies plain objects through unchanged (line 108). On reload, `unpack` reads `{ $num: '1' }` as the number 1, `{ $stub: … }` as `STUB`, and `{ $from: … }` as a source lookup. An object with `$type` is rebuilt as a leaf named `x`, with `name`, `description` and `default` added, while `$type` and `$unset` themselves are dropped. So the draft reopens holding a different value from the one saved. `pack` should escape plain-object keys that collide with its markers.
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

Notes: I couldn't write `.skulk/out/findings.md` because the write permission was not granted, so the whole document is in this reply. The checkout's HEAD is 830b463cc1, not the frozen 608f35f5 the brief names. I read the tree as it stands.

<!-- done: 5 findings, files read: 44 -->