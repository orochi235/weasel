# Audit round 46 — diagram.part1 findings

## useConnectorTool's memo omits `frame`, so a changed layout frame keeps the old tool
- where: packages/diagram/src/connectorTool.ts:34-39 (useConnectorTool)
- scenario: a host (e.g. a 3D host passing the projection onto the diagram plane) passes `frame` in the options and later changes it, keeping every listed option referentially stable → `useMemo` never rebuilds, so the connect action's `createTargets`/`bodyAt` keep reading ports and bodies through the old frame (wrong snap targets, wrong body hits). `frame` is a `FrameOptions` field the action reads (`frameFor(opts)` in connectTargets.ts); the destructured list names `poseDescriptor` but not `frame`.
- evidence: read
- severity: low

## `fit()` and a settled layout's refit compose already-world poses with their parents again, misframing anything inside a container
- where: packages/diagram/src/DiagramView.tsx:120 (`current`) with packages/diagram/src/diagramFit.ts:33 (diagramBounds) and :147-151 (useDiagramFit `now`)
- scenario: a `DiagramView` whose specs put nodes inside a boxed container or a pool (`parent` set, as `diagramScene` does for `containers`; a lane is a pool's child too). Such a parent is not an envelope, so `definesFrame` is true for it and `worldPosesOf` composes through it. `current` builds `{ ...node, pose }` from `sceneParticipants`, whose `pose` is already world (`frame.world(id)`) while `node.parent` is kept. `fitNow` (the `fit()` ref method) and `settle` (after a live layout run) hand these to `fitDiagram` → `diagramBounds` → `worldPosesOf(specs, RIGID_POSE_COMPOSITION)`, which composes each pose with its parent's again. A member of a container at world (500, 300) is counted at about (500+500, 300+300), so the fitted view is shifted/zoomed out to frame boxes that do not exist. The initial fit is right because it reads specs, whose poses are local. Should pass `parent: null` (or skip composition) for poses already in world.
- evidence: read
- severity: medium

## Double-clicking an edge's end label edits (or creates) the edge's middle label instead
- where: packages/diagram/src/edgeLabel.ts:152-159 (createEditEdgeLabelAction run) and :117-133 (beginEditing)
- scenario: an edge built from `DataEdge.endLabels` (`edge/label:from`, `edge/label:to`, both label-trait nodes depending only on the edge, so `editableLabels`/`labelUnder` and the label layer's press scratch report them). A double-click on the `to` end label yields `pressed.edgeId` (or `edgeUnder` → `label.edgeId`); the action drops `pressed.labelId` and `beginEditing` always targets `edgeLabelIdOf(edgeId)`. With no mid label, it adds an empty `edge/label` and starts editing that, leaving the end label untouched; with one, it edits the mid label. Under `DiagramView`'s `onEditLabel`, the host is told only the edge id, so it cannot know an end label was hit either. Should edit the pressed label's own id.
- evidence: read
- severity: medium

## createEdgeEnds drops the `frame` option, so edge-end handles are placed on the default plane
- where: packages/diagram/src/edgeEndLayer.ts:69-73 (createEdgeEnds)
- scenario: `EdgeEndOptions` extends `PortsOptions`, so it accepts `frame` (FrameOptions: "a 3D host passes the projection onto the diagram's plane"). `createEdgeEnds` forwards only `poseDescriptor`, `read` and `routers` to `edgeRouter`; a caller passing `frame` (as connectTargets/portsOf honor it) gets ends resolved with `frameFor({poseDescriptor})`, so the end handles and the reconnect's ends sit where the default plane puts them, not where the edges and ports are drawn under that frame.
- evidence: read
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

<!-- done: 4 findings, files read: 50 -->
