## A node's own `header` / `headerText` colors are not recorded as its own, so a theme change overwrites them
- where: packages/diagram/src/dataColors.ts:7 (NODE_FIELDS / ownNodeStyle)
- scenario: `DataNode { rows: [{ kind: 'header', text: 'T' }, …], colors: { header: '#f00', headerText: '#0f0' } }`. `diagramScene` draws the band red through `withColors` + `headerFillOf`, but `ownNodeStyle` lists only `fill`/`stroke`/`text` in `ownStyle` (`StyleField` has no header fields). On a theme change, `themeWrites.paintBand` recolors `headerFill` to the theme role's `header` (or drops it to `null`) with no own-check, and `rowColor` gives the header row the theme's `headerText`/fill. Both author colors are lost, though `DataNode.colors` says every color set is kept across a theme change.
- evidence: read (dataColors.ts NODE_FIELDS; theme/styleField.ts:3 `StyleField = 'fill' | 'stroke' | 'text'`; theme/themeWrites.ts:125-136 checks no own flag for the band or header text)
- severity: medium
- fix: packages/diagram/src/dataColors.ts, packages/diagram/src/theme/styleField.ts, packages/diagram/src/theme/themeWrites.ts
- size: function
- cause: header colors left out of the own-style vocabulary
- confidence: likely

## `DiagramViewApi.worldAt` returns client coordinates as world coordinates when the canvas is not mounted
- where: packages/diagram/src/DiagramView.tsx:256 (useDiagramApi, worldAt)
- scenario: a host calls `ref.current.worldAt(e.clientX, e.clientY)` for a drop while the canvas ref is still null (before mount, or after it unmounts). It gets `{ x: clientX, y: clientY }` back as a world point and inserts the item at a meaningless spot. Its siblings `visible` and `rectOf` return `null` in the same state, so the caller has no way to tell this answer is wrong.
- evidence: read
- severity: low
- fix: packages/diagram/src/diagramViewProps.ts
- size: line
- cause: silent fallback instead of null
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

<!-- done: 2 findings, files read: 39 -->
