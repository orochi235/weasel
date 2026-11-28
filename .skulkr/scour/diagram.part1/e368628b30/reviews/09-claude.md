## A connect may start from a body with no ports, though no connect may land on one
- where: packages/diagram/src/connect.ts:279 (createConnectAction › startEnd)
- scenario: connector tool (`startFrom: 'body'`, `bodies: true`), press on a participant whose `portsOf` is empty (e.g. `ports: []`), drag to another shape and release → `startEnd` takes `bodyAt(...)` with no port check, the edge commits glued to a body with nothing to route to, and it paints nothing. `createResolver.landing` (connectTargets.ts:208) refuses exactly that body as a landing ("A body with no ports is nothing, since an edge glued to it has nothing to route to"). The start should apply the same rule and fall through.
- evidence: read
- severity: low
- fix: packages/diagram/src/connect.ts, packages/diagram/src/connectTargets.ts
- size: line
- cause: port-less body rule checked only on the landing side
- confidence: likely

## A container stencil's ghost is drawn dashed, but the container it inserts is never dashed
- where: packages/diagram/src/StencilGhost.tsx:28 (StencilGhost)
- scenario: drag a container or pool stencil from a palette with `style` carrying `dash: [4, 4]` → the ghost is stroked with `strokeDasharray="4 4"`, but a placed region is outlined through `outlineOf(style, 'region')` (dataTypes.ts), which drops `dash` for a region, so the ghost shows an outline the drop will not produce. The ghost should read the dash the same way (`outlineOf(own, 'region')` for a `ContainerStencil`, `'body'` for a shape).
- evidence: read
- severity: low
- size: line
- cause: ghost reads dash directly instead of through outlineOf
- confidence: likely

## `worldAt` returns the client point as the world point before the canvas mounts
- where: packages/diagram/src/DiagramView.tsx:255 (useDiagramApi › worldAt)
- scenario: a host calls `ref.current.worldAt(e.clientX, e.clientY)` while the canvas ref is still null (first render, or after unmount) → it answers `{ x: clientX, y: clientY }`, a client-pixel point presented as a world point, so a drop or insert lands at an arbitrary place instead of the call reporting "no canvas". `visible()` and `rectOf()` answer `null` in the same state; `worldAt` should too (or its type should say so).
- evidence: read
- severity: low
- size: line
- cause: silent fallback to client coordinates
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
