## A node's own `header` and `headerText` colors are not listed in `ownStyle`, so a theme change overwrites or drops them
- where: packages/diagram/src/dataColors.ts:7 (ownNodeStyle, NODE_FIELDS)
- scenario: `DataNode { colors: { header: '#c00', headerText: '#fff' }, rows: [{ kind: 'header', ... }] }`. `diagramScene` draws the band red (`headerFillOf` over `withColors(style, colors)`), but `ownNodeStyle` lists only `fill`/`stroke`/`text`, so the trait's `ownStyle` omits the band. On a theme change, `paintBand` (theme/themeWrites.ts:133) recolors the band to the theme's `header`, or returns `null` and drops it when the theme names none; `rowColor` repaints the header text from the theme too. `DataNode.colors` says each color it sets is listed in `ownStyle` so a theme change leaves it. The author's band color should survive the way their fill does.
- evidence: read
- severity: medium
- fix: packages/diagram/src/dataColors.ts, packages/diagram/src/theme/styleField.ts, packages/diagram/src/theme/themeWrites.ts
- size: function
- cause: StyleField has no header/headerText field
- confidence: likely

## Layered and tree layouts leave no room for a cluster's `minWidth` when ranks run along x, so a titled cluster's box overlaps the next rank
- where: packages/diagram/src/cluster.ts:95 (rankGaps), packages/diagram/src/cluster.ts:340 (widen)
- scenario: `diagramScene` gives a labeled cluster `minWidth = title + 2·pad` (dataClusters.ts `clusterMinWidth`), and `boxAround` widens its box evenly along x to that width. With a vertical layout, `packClusters`' `widen` reserves the room across. With `layoutOptions.direction` left-to-right (rank axis x), `widen` does nothing (`axes.cross === 0` is false) and `rankGaps` adds only insets. A one-rank cluster titled wider than its member therefore gets a box that grows into the gaps on either side and overlaps nodes, or other cluster boxes, in the neighboring ranks. `chain` handles the same case in `bandGaps` → `widenForMinWidth` (chainClusters.ts:197), so the two layouts answer one question two different ways. The rank gaps should widen as chain's do.
- evidence: read
- severity: medium
- fix: packages/diagram/src/cluster.ts, packages/diagram/src/layered/plan.ts, packages/diagram/src/tree.ts
- size: function
- cause: minWidth reserved only across ranks, not along them
- confidence: likely

## `DiagramViewApi.fit()` and a settled layout run fit against a 0 × 0 box while a filling view is still unmeasured
- where: packages/diagram/src/diagramFit.ts:150 (useDiagramFit `now`, `settle`, `fitNow`)
- scenario: A `DiagramView` with no `width`/`height` is 0 × 0 until `onResize` measures it. A host that calls `ref.current.fit()` in its mount effect, or a `layout()` that settles first, reaches `fitDiagram` with size 0 × 0. `fitViewToBounds` warns ("viewport has zero or negative area") and returns the identity view passed in, and `fitNow` sets that view on the canvas. The refit effect guards `unsized`; `settle` and `fitNow` do not. Both should no-op, or defer, until the box is measured.
- evidence: read
- severity: low
- fix: packages/diagram/src/diagramFit.ts
- size: line
- cause: missing unsized guard
- confidence: sure

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
