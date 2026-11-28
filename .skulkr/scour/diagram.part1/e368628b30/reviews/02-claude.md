# Findings: diagram.part1

## A data node's own `colors.header` / `colors.headerText` are not listed in `ownStyle`, so a theme change overwrites them
- where: packages/diagram/src/dataColors.ts:7 (NODE_FIELDS / ownNodeStyle)
- scenario: `DataNode { rows: [{ kind: 'header', text: 'T' }, …], colors: { header: '#f00' } }` → `diagramScene` draws the band red (`withColors` applies `header`, `headerFillOf` writes `headerFill`), but `ownNodeStyle` lists only `fill`/`stroke`/`text`. A theme change then repaints the band from the theme (`themeWrites.paintBand` recolors to `look.style.header`, or drops `headerFill` when the theme names no header), losing the author's color. `DataNode.colors` documents "Each one set is listed in the trait's `ownStyle`, so a theme change leaves it." Same for `headerText`, which colors the header row's text.
- evidence: read
- severity: medium
- fix: packages/diagram/src/dataColors.ts, packages/diagram/src/theme/styleField.ts, packages/diagram/src/theme/themeWrites.ts
- size: function
- cause: own-color list omits header fields
- confidence: likely

## `relayoutBodies` re-measures a row that has no row node with the default style, so editing any other row changes its height
- where: packages/diagram/src/bodyRelayout.ts:117 (relayoutBodies)
- scenario: a body built with `buildBody` whose `row` callback returns `null` for one styled label row (say `style: { fontSize: 20 }`, recorded height 24) carries a `body` record. Editing another row's text calls `relayoutBodies`; the declined row has no child in `rowNodes`, so it is rebuilt as `{ kind: 'label', text: '', style: rowStyle(undefined) }` and measured at the fallback line height. `heights` differs from `layout.heights`, the trait is rewritten, and every row below shifts up although nothing about that row changed. It should keep the recorded height for a row it cannot read back (as `recordedRows` does with a slot).
- evidence: read
- severity: low
- size: function
- cause: missing row node read as empty default-styled text
- confidence: likely

## A connect may glue to a body whose every port `showsPort` turns away, and the edge then routes to a hidden port
- where: packages/diagram/src/connectTargets.ts:189 (createResolver.landing), packages/diagram/src/connectTargets.ts:224 (portFor)
- scenario: `showsPort: (p) => p.type === 'data'` on a node whose ports are all untyped, `bodies: true`. `portTarget` rejects every port, but `landing` accepts the body because `portsOf(...)` (unfiltered) is non-empty, and `portFor` resolves the body end with `resolveEnd` over all ports. The edge lands on and is drawn to a port the option documents as "never a target". `landing` and `portFor` should filter by `showsPort` the way `portTarget` does.
- evidence: read
- severity: low
- size: function
- cause: showsPort applied to port landings only, not body landings
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
