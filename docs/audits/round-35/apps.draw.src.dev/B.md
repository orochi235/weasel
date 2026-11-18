# Findings: apps.draw.src.dev

## The `transform` op kind's detail page and the shape kind's op-factory links name `createTransformOp`, which no longer exists
- where: apps/draw/src/dev/detail/OpDetail.tsx:14 (opFactoryName), used at :19 (OpKindDetail) and apps/draw/src/dev/detail/KindDetail.tsx:42 (ShapeKindDetail)
- scenario: `createTransformOp` was renamed `createSetPoseOp` (63160709ec) while the op keeps its recorded name `transform` (packages/core/src/core/ops/setPose.ts:26). `registryData.opFactoryNameFor` knows this (`FACTORY_NAMES = { transform: 'createSetPoseOp' }`), but `OpDetail.opFactoryName` is a second, older copy that always builds `create<Kind>Op`. Selecting Ops → `transform` shows factory `createTransformOp`, runtime `undefined`, no parameters, no source link and no Arguments table (`traitSchemas.ops['createTransformOp']` is missing); every shape kind's "op factories" row lists `createTransformOp` too. Should use `opFactoryNameFor` and show `createSetPoseOp` with its schema. Same decision answered two ways in two places.
- evidence: read
- severity: medium

## The Assets page's asset set leaves out text-tools: no `text` node-properties dialog and no text preset in the bundles asset
- where: apps/draw/src/dev/drawAssetSet.ts:49 (`nodes`) and :54 (`bundles`)
- scenario: WeaselDraw mounts `DRAW_FEATURES = [drawPreset, pathToolsPreset, textPreset]` (apps/draw/src/drawFeatures.ts), and `textPreset` contributes `properties: [TEXT_PROPERTIES]` (packages/text-tools/src/presets.ts:49). `nodes` maps only core's `defaultNodeProperties`, and `bundles` describes only editing's `FEATURE_PRESETS` plus `pathToolsPreset`. Opening `#/dev/assets` therefore offers no `node:text` schema and no text preset, though `DRAW_ASSET_SET`'s doc says it holds "each node's properties" and "the feature presets it loads". The registry inspector already answers this the other way: `registryData.DRAW_NODE_PROPERTIES = nodeTraitsOf(DRAW_FEATURES, …)` includes text's kind (985e8a3912). Should build both lists from `DRAW_FEATURES`.
- evidence: read
- severity: medium

## The Toolkit Builder's URL parser accepts any kit preset as the base and as a tool preset
- where: apps/draw/src/dev/ToolkitBuilder.tsx:39 (parseSetup), using `isFeature` at :29
- scenario: `isFeature` checks against all of `FEATURE_NAMES`, while the header only offers `BASES` (non-`tools:` names) in the preset Select and `TOOL_PRESETS` (`tools:*`) as switches. Loading `#/dev/toolkits?base=tools:shape` mounts a canvas whose only "base" is the shape-tools preset, and the preset Select gets a `selectedKey` none of its options carry, so it shows nothing chosen. `?tools=draw,selection` puts `draw` and `selection` into `setup.tools`. `namedFeatures(base, ...tools)` mounts them, but `switchesOn` shows no switch for them and the first switch toggle silently drops them (`TOOL_PRESETS.filter(...)`). Since `writeSetup` writes the bad setup back, the link stays bad. `base` should be checked against `BASES` and each tool against `TOOL_PRESETS`, falling back as the code already does for unknown names.
- evidence: read
- severity: low

## The ToolkitBuilder stylesheet's `.scene` rule lacks the aspect-ratio its own comment says prevents a squished first paint
- where: apps/draw/src/dev/ToolkitBuilder.module.css:69-75 (`.scene`)
- scenario: The comment says the canvas "height collapses to the intrinsic 360px and the scene paints squished/tall until a reflow happens. Stating the ratio makes first-paint sizing deterministic. Keep in sync with the props in ToolkitBuilder.tsx." The rule below it sets only `background` and `border-radius`, with no `aspect-ratio: 13 / 9`. So the column-flex `.canvas` container (`align-items: stretch`) still gets the first-layout behavior the comment describes: the 520×360 canvas is stretched to the column width with its height not following.
- evidence: read
- severity: low

## An icon's "file" row can never render: the source index is keyed by export name, but it is searched with the qualified glyph ref
- where: apps/draw/src/dev/detail/IconDetail.tsx:11 (IconDetail)
- scenario: `findSourceMatch(entry.id)` looks up `entry.id`, which is an `IconRef` such as `draw:…` or `editing:…` (registryData.ts:50 and :61-64). `virtual:weasel-source-index` is keyed by exported identifiers (apps/draw/vite-plugin-source-index.ts, `indexExports`), and no identifier contains `:`. So `match` is always null, and the "file" DetailRow and JSDoc block are dead for every icon. Either resolve the glyph to the file that declares it, or drop the row.
- evidence: read
- severity: low

## Files read
apps/draw/src/dev/AssetsPage.module.css
apps/draw/src/dev/AssetsPage.tsx
apps/draw/src/dev/DevShell.tsx
apps/draw/src/dev/DevtoolsSidebarPanel.module.css
apps/draw/src/dev/DevtoolsSidebarPanel.tsx
apps/draw/src/dev/RegistryDetail.tsx
apps/draw/src/dev/RegistryInspector.module.css
apps/draw/src/dev/RegistryInspector.tsx
apps/draw/src/dev/SchemaTable.tsx
apps/draw/src/dev/ToolkitBuilder.module.css
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

<!-- done: 5 findings, files read: 40 -->
