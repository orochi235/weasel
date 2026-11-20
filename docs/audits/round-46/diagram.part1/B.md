# Audit round 46, area diagram.part1 (frozen 6438325dbf)

## A connect with custom `routers` previews with the custom router but commits an edge that draws with the default ones
- where: packages/diagram/src/connect.ts:240-241 (createConnectAction), :217 (commitEdgeToScene)
- scenario: `createConnectAction({ participants, routers: { ...ROUTERS, wavy }, router: 'wavy' })` (or `createConnectorTool` with the same options). The live preview resolves `route = getOwn(routers, 'wavy')` and draws the wavy run; the default commit adds a node with `derivePath: EDGE_DERIVE_PATH`, which is `edgeDerivePath()` over the shipped `ROUTERS`, so `routerOf` finds no `'wavy'` and the committed edge draws `straight`. The preview no longer says what releasing does, which the module docs promise ("One resolver answers both the live preview and the commit"). The default commit should derive with a path built over the same `routers` (registered under a key so it survives `toJSON`), or the option should only be honored together with `commit`.
- evidence: read
- severity: medium

## `useConnectorTool` keeps a stale tool when only `frame` changes
- where: packages/diagram/src/connectorTool.ts:34-38 (useConnectorTool)
- scenario: a 3D host passes `frame` (the projection onto the diagram's plane, `FrameOptions.frame`) and a new one when its camera or plane changes. The memo's dependency list names `poseDescriptor` but not `frame`, so the tool keeps the connect action built over the first frame: bodies, ports and the preview are read on the old plane. The hook's doc promises a rebuild "when one of its options changes".
- evidence: read
- severity: low

## `DiagramView`'s connect previews with `portOptions.router` (default `straight`) but reports an edge with no router, which `diagramScene` draws as `bezier`
- where: packages/diagram/src/diagramEditing.ts:168-180 (useDiagramEditing, the `ports` commit)
- scenario: `<DiagramView onConnect={(e) => setData(add(e))} portOptions={{ router: 'orthogonal' }}>` (or no `portOptions`, where the preview router is `connect.ts`'s `DEFAULT_ROUTER = 'straight'`). The drag draws an orthogonal (or straight) connector; the commit builds the reported `DataEdge` from `from`/`to` only and drops `PendingEdge.router`, so the host stores an edge with no `router`, and `edgeSpecs` draws it with `opts.router ?? 'bezier'`. The edge changes shape the moment it is released. The report should carry `router` (DataEdge has the field), or the preview should draw with the router the scene will use.
- evidence: read
- severity: low

## `createEdgeEnds` drops the `frame` option, so edge-end handles and reconnects resolve routes on the wrong plane for a 3D host
- where: packages/diagram/src/edgeEndLayer.ts:69-73 (createEdgeEnds)
- scenario: `createDiagramEdgeEndsContribution({ participants, selected, frame: projection })` (or `createEdgeEndAffordance` with `frame`). `EdgeEndOptions` extends `PortsOptions`, which extends `FrameOptions` with `frame`, but `createEdgeEnds` builds `edgeRouter` from `poseDescriptor`, `read` and `routers` only. `frameFor` then falls back to `layoutFrameOf(poseDescriptor ?? AUTO_POSE_DESCRIPTOR)`, so the end handles sit, and the reconnect preview starts, where the route lands on the pose's own space rather than on the projected plane the edge is drawn on. Passing `opts` through whole (or adding `frame`) fixes it.
- evidence: read
- severity: medium

## `relayoutBodies` measures rows in the stored face, not the face the body was built with, so the first relayout of an unchanged body rewrites its heights and restacks it
- where: packages/diagram/src/bodyRelayout.ts:113-131 (relayoutBodies), against body.ts:125-129 (measureText's fallback)
- scenario: a body built without a font-filling `measure` — `stencilInsertOps(stencil, …)` with no `opts.measure`, or `buildBody` called directly — is measured from the row's own style, which has no `fontSize`, so `measureText` gives each text row `FALLBACK_LINE` (16) and `bodyLayoutOf` records `heights: [16, …]`. Its text nodes store the resolved face (`rowTextStyle(row, DEFAULT_FONT)`, fontSize 12). `relayoutBodies` (run by `applyTheme` and the late-font remeasure) rebuilds each row with `rowStyle(data.style)`, fontSize 12, and measures `ceil(12 × 1.2) = 15`. The heights differ although no text changed, so the trait is rewritten and every row is moved: a theme change shifts the rows of every stencil-inserted shape. The build and the relayout should measure the same face (fill the face before measuring in both, or record the face measured).
- evidence: read (heights worked through by hand, not run)
- severity: low

## `fit()` and the refit after a layout run compose world poses a second time, so a diagram with containers is framed off its real bounds
- where: packages/diagram/src/DiagramView.tsx:120 (`current`), packages/diagram/src/diagramFit.ts:32-35 (diagramBounds), :148-151 (`now`)
- scenario: `current()` hands `fitDiagram` each scene node spread with `pose` from `sceneParticipants`, which is `frame.world(id)`, already world; the spread keeps the node's `parent`. `diagramBounds` then runs `worldPosesOf(specs, RIGID_POSE_COMPOSITION)`, which treats each pose as stored in its parent's frame and folds the parent's (world) pose in again. A shape at world (500, 300) inside a container at world (400, 200) counts as (900, 500), and a nested region is offset further. `ref.fit()` and the fit `settle()` applies once a `layout()` run settles then frame a box past the diagram (zoomed out and off-center). Specs (local poses) are folded correctly; only the `current()` path is wrong. It should pass local poses (`node.pose`) or drop `parent` when the poses are world. This came in with 8c6162ac04 ("store diagram children in their container's frame"), which made `diagramBounds` compose but left `current` handing it world poses.
- evidence: read (traced `sceneParticipants` → `frame.world` and `worldPosesOf` → `composeWorldPose`; not run)
- severity: medium

## `useDiagramTools` gives every shipped container stencil a tool, but the insert its doc pairs it with does not build containers unless told to
- where: packages/diagram/src/diagramTools.ts:41-53 (SHIPPED_STENCILS, useDiagramTools doc)
- scenario: following the doc ("needs `presets.insert` on, and `useStencilInsert` beside them"), a host calls `useDiagramTools({ connector })` and `useStencilInsert(FLOWCHART_STENCILS)`. `SHIPPED_STENCILS` flattens every group in `STENCIL_GROUPS`, `CONTAINERS_GROUP` included, so the palette offers a tool per container stencil. `useStencilInsert` (stencilTool.ts:73-77) finds a stencil only among the `stencils` it was handed or `opts.containers`. A container stencil's `stencil:<id>` kind matches neither, so the drag goes to the displaced `insert` dep and does not build the container. The doc should name `containers: CONTAINER_STENCILS`, or the default tool list should leave out what the paired insert cannot build.
- evidence: read (where the fallthrough lands is inferred, not run)
- severity: low

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
packages/diagram/src/diagramTypes/types.ts
packages/diagram/src/diagramViewProps.ts
packages/diagram/src/edge.ts
packages/diagram/src/edgeEndLayer.ts
packages/diagram/src/edgeId.ts
packages/diagram/src/edgeLabel.ts
packages/diagram/src/edgeStroke.ts
packages/diagram/src/edgeTrait.ts
packages/diagram/src/effect-audio.entry.ts
packages/diagram/src/effect.entry.ts
packages/diagram/src/entryMemo.ts

<!-- done: 7 findings, files read: 50 -->
