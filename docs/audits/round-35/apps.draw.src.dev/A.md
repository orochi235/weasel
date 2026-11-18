# Findings: apps.draw.src.dev

## The op-kind detail names `transform`'s factory `createTransformOp`, which no longer exists
- where: apps/draw/src/dev/detail/OpDetail.tsx:14 (opFactoryName), used at OpDetail.tsx:19 (OpKindDetail) and detail/KindDetail.tsx:42 (ShapeKindDetail)
- scenario: Since 63160709ec renamed `createTransformOp` to `createSetPoseOp`, the `transform` op kind (registered at packages/core/src/core/ops/setPose.ts:45) is built by `createSetPoseOp`. registryData.ts:84-89 (`opFactoryNameFor`, `FACTORY_NAMES`) handles that. OpDetail's own `opFactoryName` does not, so the same question gets two answers. If you select Ops → transform, the detail shows "factory createTransformOp" and "runtime undefined", with no parameters row, no source link, no JSDoc and no Arguments table, because `getOwn(Weasel, 'createTransformOp')`, `findSourceMatch` and `traitSchemas.ops[...]` all miss. Every shape kind's "op factories" row also labels its transform link `createTransformOp`. The detail should use `opFactoryNameFor`.
- evidence: read
- severity: medium

## The Assets page's bundles asset files editing's presets under `@weasel-js/core`
- where: apps/draw/src/dev/drawAssetSet.ts:690 (bundles)
- scenario: `describePresets` gets `{ '@weasel-js/core': Object.values(FEATURE_PRESETS) }`, but `FEATURE_PRESETS` is `@weasel-js/editing`'s table (packages/editing/src/namedPresets.ts). Most of its presets (selection, insert, select, move, resize, delete, group, align, …) have been defined in editing since 670aeb3adc moved them. `bundlesAsset` makes one section per package (packages/prefs/src/edit/assetSet.ts:40), so the Assets editor shows every editing preset in a `@weasel-js/core` section. Only `view` and `tools:view` come from core. Each preset should be keyed by the package that defines it.
- evidence: read
- severity: low

## The Toolkit Builder accepts a tool preset as its base preset from the URL
- where: apps/draw/src/dev/ToolkitBuilder.tsx:39 (isFeature) and :45 (parseSetup)
- scenario: `isFeature` tests against all of `FEATURE_NAMES`, but the base picker offers only `BASES`, which leaves out the `tools:*` names. So `#/dev/toolkits?base=tools:shape` parses to `base: 'tools:shape'`. The canvas then mounts with no base preset (no view, pick or select), the preset `Select` is handed a `selectedKey` none of its options carries, so it shows nothing selected, and `writeSetup` writes the bad base back into the hash. A base outside `BASES` should fall back to `'draw'`.
- evidence: read
- severity: low

## The registry probe's re-render signature leaves out ambient tools, which the toolkit reflection includes
- where: apps/draw/src/dev/registryProbe.tsx:61 (handleToolsCreated)
- scenario: The probe re-renders only when the sorted `Object.keys(api.registry)` changes. `useToolReflection` (toolkit/useToolReflection.ts:30-33) answers the same question with the ambient ids (`~id`) included. If a ToolsApi arrives whose ambient slot changed but whose registry did not, the probe sets no state, so it does not re-render. `toolEntries` and the snapshot effect then keep the old ambient list, and the Bundle Inspector's Slots → ambient, gesture counts and phase-output counts stay stale until something else re-renders the probe. The ambient ids belong in the signature, as the reflection does it.
- evidence: read
- severity: low

## Files read
apps/draw/src/dev/AssetsPage.tsx
apps/draw/src/dev/DevShell.tsx
apps/draw/src/dev/DevtoolsSidebarPanel.tsx
apps/draw/src/dev/RegistryDetail.tsx
apps/draw/src/dev/RegistryInspector.tsx
apps/draw/src/dev/SchemaTable.tsx
apps/draw/src/dev/ToolkitBuilder.tsx
apps/draw/src/dev/badgeTokens.ts
apps/draw/src/dev/detail/BundleDetail.tsx
apps/draw/src/dev/detail/ExportsDetail.tsx
apps/draw/src/dev/detail/GestureDetail.tsx
apps/draw/src/dev/detail/IconDetail.tsx
apps/draw/src/dev/detail/KindDetail.tsx
apps/draw/src/dev/detail/MetaDetail.tsx
apps/draw/src/dev/detail/OpDetail.tsx
apps/draw/src/dev/detail/RouteBadge.tsx
apps/draw/src/dev/detail/SlotDetail.tsx
apps/draw/src/dev/detail/shared.tsx
apps/draw/src/dev/detail/sourceLinks.tsx
apps/draw/src/dev/devRoutes.ts
apps/draw/src/dev/drawAssetSet.ts
apps/draw/src/dev/registryData.ts
apps/draw/src/dev/registryEntries.ts
apps/draw/src/dev/registryProbe.tsx
apps/draw/src/dev/resolutionInput.ts
apps/draw/src/dev/sourceIndex.types.ts
apps/draw/src/dev/sourceLookup.ts
apps/draw/src/dev/toolkit/ActionsWidget.tsx
apps/draw/src/dev/toolkit/ConflictsWidget.tsx
apps/draw/src/dev/toolkit/DispatchTraceWidget.tsx
apps/draw/src/dev/toolkit/ResolutionWidget.tsx
apps/draw/src/dev/toolkit/RoutesWidget.tsx
apps/draw/src/dev/toolkit/ToolsWidget.tsx
apps/draw/src/dev/toolkit/gridCells.tsx
apps/draw/src/dev/toolkit/useToolReflection.ts
apps/draw/src/dev/traitSchemas.types.ts

<!-- done: 4 findings, files read: 36 -->
