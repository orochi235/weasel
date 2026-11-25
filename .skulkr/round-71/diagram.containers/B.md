# Audit round 71 — diagram.containers

## A double-click on a locked (or otherwise uneditable) region's header still starts editing its title
- where: packages/diagram/src/containers/containerTitle.ts:24 (regionHeaderAt), :52 (createEditContainerTitleAction run/enabled)
- scenario: lock a container (or a pool/lane, or just its `<id>/title` node) and double-click its header. `regionHeaderAt` walks from `nodeAtPoint` up the parents and returns the first region whose header holds the point, checking neither `scene.isLocked(id)` nor `scene.isLocked(titleIdOf(id))`; the action is enabled and `commit(id)` runs, so `regionEditing` reports `{ kind: 'title', id }` and the host opens a title editor that writes a locked node. Every other container edit in this area (add lane, lane resize, release members) refuses where it would write a locked node (`restackLocked`, `laneResizeLocked`, `releasePlan`); the title edit should decline (return null / NotApplicable) the same way.
- evidence: read (no lock check in regionHeaderAt, the action, or its caller in packages/diagram/src/regionEditing.ts:78)
- severity: medium

## `commitLaneResizeToScene` writes the pool and lanes without checking locks
- where: packages/diagram/src/containers/containerActions.ts:59 (commitLaneResizeToScene), :64 (writeLaneResize)
- scenario: `commitLaneResizeToScene` is the exported default commit a consumer's `commitResize` is meant to call or wrap. It looks the pool up with `poolLanesOf`, which (unlike `poolsOf`) returns locked pools as well, and `writeLaneResize` then `setPose`s the pool, its title, the lane and every later lane with no `laneResizable` check. A deferred or wrapped commit, or a lock set between the drag's `start` (the only place `laneResizable` is checked) and `onEnd`, writes locked nodes. The commit should re-check `laneResizable` (and the pool's own lock) before writing, as `addLane` re-checks `addLaneLocked` itself rather than trusting its caller.
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
