# Findings: diagram.part1

## A node's own `header` / `headerText` colors are not listed in `ownStyle`, so a theme change overwrites them
- where: packages/diagram/src/dataColors.ts:7 (ownNodeStyle, NODE_FIELDS)
- scenario: a `DataNode` with a header row and `colors: { header: '#f00' }` is built: `withColors` puts `header` into its style and `headerFillOf` writes `headerFill` red. `ownNodeStyle` lists only `fill`/`stroke`/`text` (StyleField has no `header`), so `ownStyle` omits it. Applying a theme then runs `paintBand` (theme/themeWrites.ts:133), which recolors `headerFill` to the theme's `header`, or drops it to `null` when the theme has none. The author's band color is lost. `headerText` goes the same way through `rowColor`. `DataNode.colors` says "Each one set is listed in the trait's `ownStyle`, so a theme change leaves it".
- evidence: read (dataColors.ts, theme/styleField.ts:3, theme/themeWrites.ts:107-137)
- severity: medium
- fix: packages/diagram/src/theme/styleField.ts, packages/diagram/src/theme/themeWrites.ts
- size: function
- cause: header colors not tracked as own fields
- confidence: sure

## A pool box too small for its unsized lanes lets them stack past the box
- where: packages/diagram/src/dataContainers.ts:139 (laneSizes)
- scenario: a pool with `box.height: 100` and three lanes that give no `size`. `share` = 33.3 and each lane is clamped up to `MIN_LANE_SIZE` (40). The last-lane correction is clamped to 40 again, so the lanes total 120. `stackedLanes` (dataContainerPlace.ts:83) places them from the box's top, and the third lane runs 20 units below the pool. The pool box is never grown to fit. Given sizes over `along` also get the last lane silently cut down (lanes of 150 and 150 in a box of 200 come out 150 and 50).
- evidence: read (laneStack.ts:34, 47-61)
- severity: low
- fix: packages/diagram/src/dataContainerPlace.ts
- size: function
- cause: min clamp applied after the share, never reconciled with the box
- confidence: sure

## `buildBody` gives leaves world poses but also sets `parent`, so a consumer spreading them into a rigid scene offsets every row twice
- where: packages/diagram/src/buildBody.ts:78 (buildBody, leaf)
- scenario: `buildBody` is public (index.ts:30, layout.entry.ts:37), and its doc says a consumer "can still spread one". With `id` set, each leaf gets `parent: opts.id` and a pose laid out at the body's world `x, y` (`layoutBody(spec, pose)`). Under the scene's default `RIGID_POSE_COMPOSITION`, a child pose is stored in its parent's frame, so a body at (200, 100) draws its rows at about (400, 200). Both internal callers know to run `localizeWorldPoses` first (fromData.ts:147, stencil.ts:120), but nothing in `buildBody`'s docs says the poses are world. Its sibling `relayoutBodies` expects rows in the body's frame.
- evidence: read
- severity: low
- fix: packages/diagram/src/buildBody.ts (localize, or document world poses)
- size: line
- cause: undocumented frame contract on public output
- confidence: likely

## Files read
packages/diagram/src/DiagramView.tsx
packages/diagram/src/StencilGhost.tsx
packages/diagram/src/actionParamSchema.ts
packages/diagram/src/applyEdit.ts
packages/diagram/src/batchedEdits.ts
packages/diagram/src/body.ts
packages/diagram/src/bodyFollower.ts
packages/diagram/src/bodyNode.ts
packages/diagram/src/bodyRelayout.ts
packages/diagram/src/bodyRules.ts
packages/diagram/src/buildBody.ts
packages/diagram/src/chain.ts
packages/diagram/src/chainClusters.ts
packages/diagram/src/chainRoutes.ts
packages/diagram/src/cluster.ts
packages/diagram/src/clusterBox.ts
packages/diagram/src/clusterFixture.ts
packages/diagram/src/clusterReorder.ts
packages/diagram/src/clusterTree.ts
packages/diagram/src/clusterUpgrade.ts
packages/diagram/src/connect.ts
packages/diagram/src/connectTargets.ts
packages/diagram/src/connectorTool.ts
packages/diagram/src/contribution.ts
packages/diagram/src/dataClusters.ts
packages/diagram/src/dataColors.ts
packages/diagram/src/dataContainerPlace.ts
packages/diagram/src/dataContainers.ts
packages/diagram/src/dataEdges.ts
packages/diagram/src/dataPages.ts
packages/diagram/src/dataStyles.ts
packages/diagram/src/dataTypes.ts
packages/diagram/src/diagramEditing.ts
packages/diagram/src/diagramFit.ts
packages/diagram/src/diagramTools.ts
packages/diagram/src/diagramTypes/catalog.ts
packages/diagram/src/diagramTypes/doc.ts
packages/diagram/src/diagramTypes/edge.ts
packages/diagram/src/diagramTypes/index.ts

<!-- done: 3 findings, files read: 39 -->
