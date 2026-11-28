# Findings: diagram.part1

## A connect can start from a portless body that no connect may land on
- where: packages/diagram/src/connect.ts:279 (createConnectAction → startEnd)
- scenario: connector tool (`startFrom: 'body'`) pressed on a participant that offers no ports (e.g. a body whose `ports: []`). `startEnd` takes `bodyAt(...)` as the `from` end without checking that the body has ports. `connectTargets.landing` refuses exactly that case ("A body with no ports is nothing, since an edge glued to it has nothing to route to"). So the edge gets committed with a `from` that has no port to resolve to, and it draws nothing or draws wrong. The press should fall through, the way a release over the same body does.
- evidence: read
- severity: medium
- fix: packages/diagram/src/connect.ts, packages/diagram/src/connectTargets.ts
- size: line
- cause: portless-body rule applied on landing only
- confidence: likely

## StencilGhost draws a container stencil dashed, but the container lands undashed
- where: packages/diagram/src/StencilGhost.tsx:28 (StencilGhost)
- scenario: dragging a container or pool stencil from a palette with a `style` that has `dash`. The ghost strokes with `own.dash`. The container that lands is outlined through `outlineOf(style, 'region')`, which drops dash for a container or pool ("a container or pool undashed, whatever the style says"). So the drag preview doesn't match what a click places. The ghost should take its width and dash from `outlineOf(own, 'region' | 'body')`.
- evidence: read
- severity: low
- fix: packages/diagram/src/StencilGhost.tsx
- size: line
- cause: outline rule duplicated instead of reading outlineOf
- confidence: sure

## relayoutBodies re-measures an undrawn text row as empty text
- where: packages/diagram/src/bodyRelayout.ts:122 (relayoutBodies)
- scenario: `buildBody` lets `row` return `null` for a text row the consumer paints itself, so that row has no child node with `bodyRow`. `bodyLayoutOf` still records the body, because every row is text. On relayout, the row is rebuilt as `{ kind: 'label', text: '' }` with no style, so its height becomes one unstyled fallback line rather than its real measured height. `heights` is then rewritten, and every row below it shifts from where the build put it. The row's recorded height should be kept when no node backs it.
- evidence: read
- severity: low
- fix: packages/diagram/src/bodyRelayout.ts
- size: function
- cause: missing row node treated as empty text
- confidence: likely

## A batched onEdit fires after the view unmounts
- where: packages/diagram/src/batchedEdits.ts:36 (useBatchedEdits → gather)
- scenario: a gesture or layout run reports `onMove` and then the view unmounts in the same task. For example, the host swaps the diagram out in response to the same `onMove`. The queued microtask still calls `latest.current.onEdit` with that batch, after teardown, so the host can write an edit into data for a view that no longer exists. Nothing cancels the pending batch on unmount or when `batching` turns off.
- evidence: read
- severity: low
- fix: packages/diagram/src/batchedEdits.ts
- size: function
- cause: microtask not canceled on teardown
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

<!-- done: 4 findings, files read: 39 -->
