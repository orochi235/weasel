## `commitLaneResizeToScene` writes locked nodes and sizes below `MIN_LANE_SIZE`
- where: packages/diagram/src/containers/containerActions.ts:59 (commitLaneResizeToScene / writeLaneResize)
- scenario: a consumer's `commitResize` (or any caller) passes the exported default commit a `LaneResize` for a pool whose later lane is locked, or with `size: 10` (or negative). The drag action checks `laneResizable` and clamps to `MIN_LANE_SIZE` before it commits, but `writeLaneResize` does neither. It writes the locked lane's pose and a lane shorter than the minimum (or a negative height) in one history entry. The exported commit should refuse what the action refuses (`laneResizeLocked`) and clamp as `sizeAt` does. `addLane` and `releaseMembers` both check locks themselves.
- evidence: read
- severity: low

## A pool's stack axis is answered two ways: by its header in `poolAxisOf`, and by its layout key in `laneStackLayout`
- where: packages/diagram/src/containers/containerStencils.ts:77 (poolAxisOf); packages/diagram/src/containers/canDropInto.ts:39-40 (diagramCanDropInto)
- scenario: take a pool node whose layout is `diagram:pool-columns` and whose trait has no `header`, or whose header was edited. `poolAxisOf` reads `header?.side === 'top'`, so it treats the pool as rows ('y'). `lanesOf`, `addLane`, the boundary layer and the resize action then sort, place and measure lanes along y, while the pool's layout stacks them along x. `diagramCanDropInto` also matches a lane only when its `header.side` equals the pool's. A pool with no header (side `undefined`) therefore rejects every lane, including lanes `addLane` builds for it with a 'left' header. The axis should come from one definition.
- evidence: read
- severity: low

## Files read
packages/diagram/src/containers/canDropInto.ts
packages/diagram/src/containers/containerActions.ts
packages/diagram/src/containers/containerLayout.ts
packages/diagram/src/containers/containerStencils.ts
packages/diagram/src/containers/containerTitle.ts
packages/diagram/src/containers/index.ts
packages/diagram/src/containers/laneBoundaryLayer.ts
packages/diagram/src/containers/laneStack.ts
packages/diagram/src/containers/layouts.ts
packages/diagram/src/containers/regionSpecs.ts
packages/diagram/src/containers/titlePose.ts
packages/diagram/src/containers/trait.ts

<!-- done: 2 findings, files read: 12 -->
