# Findings: diagram.part3

## Reconnect's fixed end resolves its port without the caller's `frame`
- where: packages/diagram/src/reconnect.ts:125 (fixedEndOf)
- scenario: `ReconnectOptions` extends `ConnectActionOptions`, which extends `FrameOptions` (so a host such as kernel3d passes `frame`). `fixedEndOf` builds the `portOf` options from `poseDescriptor` and `read` only, dropping `frame`, so `frameFor` falls back to the pose descriptor's own space. With a host frame (e.g. kernel3d's descriptor answers screen boxes), the stationary end's port is placed in a different plane from the moving end, the targets and the drawn ports: the reconnect preview's route and the `fixed` end handed to `canConnect` sit at the wrong point. It should pass `frame` through, as `createPortAffordance` does via `frameFor(opts)`.
- evidence: read
- severity: medium

## A stencil's rows are measured at a different face from the one they are drawn in
- where: packages/diagram/src/stencil.ts:92-102 (stencilInsertOps)
- scenario: `stencilInsertOps` (and `useStencilInsert`, which forwards `measure` and `font` to it) hands `opts.measure` to `buildBody` and `bodyLayoutOf` raw, while each row's drawn style is `rowTextStyle(box.row, opts.font ?? DEFAULT_FONT)`, which fills in `font`'s family and size. Stencil rows carry no `fontSize` (`DEFAULT_ROWS` is `{ kind: 'label', text: '' }`, and the flowchart stencils' rows set no `fontSize`), so `rendererMeasure`/`canvasMeasure` measure them at their own fallback, 16px `sans-serif`, and with no `measure` `body.ts`'s `measureText` uses `FALLBACK_LINE` 16. The text is drawn at 12px (`DEFAULT_FONT`), or at whatever `font` the host passed (e.g. 20px), so the body's row heights and content fit are computed for a face it does not draw: rows too tall at the default, and text overflowing its row when `font` is larger than 16. `diagramScene` (`fromData.ts:158-167`) wraps `measure` to fill in `font.fontFamily` / `font.fontSize` first; the stencil path should do the same.
- evidence: read
- severity: medium

## Reset route and Remove waypoint don't check for locked edges, and the scene throws when they commit
- where: packages/diagram/src/routeCommands.ts:78-108 (routedEdges / createResetRouteAction), :44-55,73 (removalAt / enabled)
- scenario: Take a selection that holds a locked edge with waypoints, say an edge locked after it was selected, or one on a locked layer. The set-router commands handle this: `routerPlan` answers `'locked'` and the command is disabled with `ActionDisabledReason.Locked`. `diagram.resetRoute` does not: `routedEdges` never asks `scene.isLocked`, so the command shows as enabled, and `run` calls `commitRouteToScene` → `scene.update`. The scene's lock guard then throws ("cannot update … locked") inside the `'Reset route'` batch, so the command errors and the other selected edges are not reset either. `diagram.removeWaypoint` has the same gap. The waypoint layer hides a locked edge's handles (`offersPorts`), but `removalAt` scans every selected edge's handle positions with no lock or `offersPorts` check. A double-click where a locked edge's handle would sit therefore enables the action and commits into the same throw. A locked edge should be filtered out, or should disable the command, as `routerPlan` does.
- evidence: read (lock guard: packages/core/src/core/scene/lockGuard.ts:52-55)
- severity: medium

## The port-placement outline polyline joins separate subpaths with segments that aren't part of the outline
- where: packages/diagram/src/onOutline.ts:38-73 (flattenPath)
- scenario: `flattenPath` writes every subpath into one flat polyline. A second `M` pushes its point straight after the previous subpath's last point, and the final "close it" step joins the last subpath back to the first point. `rayHit` then treats those joining segments as outline edges and keeps the farthest crossing. Some outlines have several subpaths: the built-in `person` (body plus a separate head subpath, `outlines/figures.ts:214-226`), or a consumer `Path` / `registerOutline` shape made of two disjoint pieces. For those, a port whose ray crosses a joining segment beyond the real boundary is moved onto that segment, in empty space between the pieces, rather than onto the shape. With `person`, an `nw`-ish anchor already lands on the head-to-body joining segment, slightly outside the body's top edge. Each subpath should be flattened as its own closed ring.
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

<!-- done: 4 findings, files read: 48 -->
