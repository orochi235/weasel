I couldn't write `.skulk/out/findings.md` because permission was denied, so the whole findings document is below.

# Audit round 46 — diagram.part3 findings

## Waypoint follower rewrites a locked connector's data, so a move of its two unlocked ends throws
- where: packages/diagram/src/waypointFollower.ts:40-56 (followers), :80-87 (finish)
- scenario: Connector `ab` has waypoints and sits on a locked layer (or is locked itself). Its ends `a` and `b` are unlocked, and the user selects both and moves them. `followers` never checks `isLocked`, so `finish` appends `coreOps.setData` for `ab`. When that op is applied, `scene.update` reaches the lock guard (`fieldEdits.ts:50` → `lockGuard.refuse`), which throws "cannot update ab", and the whole move is refused. The preview also shows the locked route moving. The diagram's edit passes and `routeWrites` (routeWrites.ts:59) leave locked connectors alone, so here the same lock decision is answered two different ways. The fix is to skip edges that `sc.isLocked(node.id)` reports.
- evidence: read
- severity: high

## Reset route ignores locks: enabled with a locked connector selected, then throws
- where: packages/diagram/src/routeCommands.ts:78-108 (routedEdges, createResetRouteAction)
- scenario: Select a locked connector that has waypoints and run "Reset route". `enabled` checks only that a selected edge has waypoints, so the command is offered. `run` calls `commitRouteToScene`, whose `scene.update` throws from the lock guard partway through the batch. The router commands next to it (routerCommands.ts:79-87) were changed on purpose to report `ActionDisabledReason.Locked` in this case, so the same rule is applied two ways. The fix is to filter or disable on `deps.scene.isLocked(id)` as `routerPlan` does.
- evidence: read
- severity: medium

## Reconnect places the fixed end's port without the caller's `frame`
- where: packages/diagram/src/reconnect.ts:121-130 (fixedEndOf)
- scenario: Call `createReconnectAction({ frame: planeFrame, … })` from a host whose diagram plane is not the pose descriptor's space (`LayoutFrame`'s stated kernel3d case). `fixedEndOf` passes `portOf` only `poseDescriptor` and `read`, so the fixed end is placed through `layoutFrameOf(poseDescriptor ?? AUTO)`. Meanwhile the resolver (`createTargets` → `frameFor(opts)`, connectTargets.ts:60/145-146) places candidates and draws the preview through `opts.frame`. The rubber band and the `canConnect(fixed, candidate)` check therefore see the fixed end on a different plane from the candidates. It should pass `frame: frameFor(opts)`, as connectTargets.ts:146 does.
- evidence: read
- severity: medium

## reorderTargetOf never returns when cluster boxes hold each other in a dependsOn loop
- where: packages/diagram/src/reorderModel.ts:82 (reorderTargetOf loop), with holders at :34-44
- scenario: A scene's cluster box A has `dependsOn` [B, …] and cluster box B has [A, …]. Core treats `dependsOn` as unvalidated and is cycle-safe elsewhere. Such a loop can come from a consumer-built scene, `setDependsOn`, or a loaded scene, but not from `nestClusters` data. Neither box sets `reorder`. `holders` maps A→B and B→A, so a press on any member climbs A→B→A… forever. `clusterReorderSlots` runs this from the reorder action's `enabled`/`start` on every press, so the tab hangs. The same class of bug was fixed in the effect editor's `groupAt` (4b25e60c79). The climb needs a seen-set.
- evidence: read
- severity: medium

## Remove waypoint's point fallback ignores locked and hidden edges
- where: packages/diagram/src/routeCommands.ts:44-55 (removalAt), :63-73 (run, enabled)
- scenario: The handle layer offers no handles on a locked or hidden edge (`offersPorts`, waypointLayer.ts:125). `removalAt` still walks every selected edge's handles with no such gate, and it is used both for `enabled` and as `run`'s fallback when the press carries no waypoint payload. If the action is invoked by id with a `world` point (a command or a binding other than the affordance double-click) over a selected locked edge's handle, it is reported enabled, and `commitRouteToScene` then throws from the lock guard. A hidden selected edge gets its waypoint removed without being drawn.
- evidence: read
- severity: low

## createDiagramNodes gives kind traits to edges, labels and lanes whose own trait opts out
- where: packages/diagram/src/trait.ts:76-84 (createDiagramNodes reader)
- scenario: `dataKeyReader` returns `null` for a node whose `data.diagram` is an edge (`from`/`to`), a label, an anchor, a mark, a sequence part or a lane, so that these take no ports. `createDiagramNodes` treats that `null` as "no own trait" and falls through to the kind entries. With an entry whose `matches` is broad (any record, say), every connector and lane becomes a participant with the four default ports on its placeholder pose. That is the failure `dataKeyReader`'s own comment describes. It also contradicts the docstring's "a single node can opt out", since no own trait can make the reader answer `null`.
- evidence: read
- severity: low

## Files read
packages/diagram/src/onOutline.ts
packages/diagram/src/outline.ts
packages/diagram/src/overlays.tsx
packages/diagram/src/passOrder.ts
packages/diagram/src/payload.ts
packages/diagram/src/pbt.fixture.ts
packages/diagram/src/polyline.ts
packages/diagram/src/portAffordance.ts
packages/diagram/src/portLabels.ts
packages/diagram/src/portLayer.ts
packages/diagram/src/ports.ts
packages/diagram/src/radial.ts
packages/diagram/src/reconnect.ts
packages/diagram/src/regionEditing.ts
packages/diagram/src/regionSync.ts
packages/diagram/src/releaseOnUnmount.ts
packages/diagram/src/rendererMeasure.ts
packages/diagram/src/reorder.ts
packages/diagram/src/reorderModel.ts
packages/diagram/src/reorderSlide.ts
packages/diagram/src/resizable.ts
packages/diagram/src/route.ts
packages/diagram/src/routeCommands.ts
packages/diagram/src/routeSnapSource.ts
packages/diagram/src/routeWrites.ts
packages/diagram/src/routerCommands.ts
packages/diagram/src/routers.ts
packages/diagram/src/rowMeasure.ts
packages/diagram/src/rowStyle.ts
packages/diagram/src/sceneSync.ts
packages/diagram/src/selfLoop.ts
packages/diagram/src/shape.ts
packages/diagram/src/specWorld.ts
packages/diagram/src/stencil.ts
packages/diagram/src/stencilTool.ts
packages/diagram/src/subpaths.ts
packages/diagram/src/testing/dataClusters.ts
packages/diagram/src/trait.ts
packages/diagram/src/tree.ts
packages/diagram/src/types.ts
packages/diagram/src/unknownRefs.ts
packages/diagram/src/useFaceRemeasure.ts
packages/diagram/src/usePagesView.ts
packages/diagram/src/waypointAction.ts
packages/diagram/src/waypointFollower.ts
packages/diagram/src/waypointLayer.ts
packages/diagram/src/waypoints.ts
packages/diagram/src/worldWith.ts

<!-- done: 6 findings, files read: 48 -->