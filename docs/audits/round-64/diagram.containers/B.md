# Audit round 64 — diagram.containers (reviewer findings)

Note: the brief names commit 49e5a07e6aecc7037a5e3692706cf28dd58211c4, which this clone does not contain
(`git cat-file` reports a bad object). The tree read is HEAD 6f634fabe1 with no local changes under
`packages/diagram/src/containers`.

## addLane places the new lane in the pool's local frame whatever the scene's composition, so under IDENTITY_POSE_COMPOSITION it lands near the world origin and restacks into the wrong place
- where: packages/diagram/src/containers/containerStencils.ts:101-115 (addLane)
- scenario: a `diagramScene(..., { composition: IDENTITY_POSE_COMPOSITION })` (as `effect/lanesRoutes.ts:231` builds) stores every lane at its world pose. Pool at world (300, 500), 400×240, lanes at world y 500 and 620. `addLane(scene, pool)` builds `b = {x:0, y:0, width, height}` and puts the new lane at world (32, 180) — `localizeWorldPoses` under identity leaves it there. The lane stack then orders by midpoint (240 < 560 and 680), so the "added at the end" lane is stacked first. With `index` given, `lanes[index].pose` is a world pose compared against the local `b`, mixing frames. Should place the lane in the frame the scene stores lanes in (the pool's world box under identity), as `releasePlan` does through `scenePoseFrame`.
- evidence: read
- severity: medium

## The default lane-resize commit leaves later lanes' members behind under a non-rigid composition, though the preview carried them
- where: packages/diagram/src/containers/containerActions.ts:50-69 (commitLaneResizeToScene) vs :93-97 (laneResizeFrame)
- scenario: under IDENTITY_POSE_COMPOSITION, members of a lane store world poses. Dragging lane 1's boundary down by 50: `laneResizeFrame` previews lane 2 and, through `carriedDescendants` (composition-aware), lane 2's members shifted 50. On commit, `commitLaneResizeToScene` writes only the lanes' and the pool's poses; lane 2's members (free placement under `diagramContainerLayout`, which places only the title) stay where they were, now 50 units up out of their lane or in lane 1. The commit should write the same carried poses the preview showed.
- evidence: read
- severity: medium

## laneResizeFrame previews titles in the container's local frame regardless of the scene's composition
- where: packages/diagram/src/containers/containerActions.ts:81-86 (laneResizeFrame, placeTitle)
- scenario: `titleInFrame` returns a pose anchored at (0, 0), which is right only when a title is stored in its container's frame (RIGID). Under IDENTITY_POSE_COMPOSITION a title stores its world pose, so during a lane drag the resized lane's and the pool's titles preview at the world origin, then snap back when the layout places them on commit. Should go through the scene's composition (or `titlePose` on the world box) as the descendants beside it do.
- evidence: read
- severity: low

## A pool shrunk below its lanes leaves the lanes spilling out of it
- where: packages/diagram/src/containers/laneStack.ts:104-112 (laneStackLayout.childPoses)
- scenario: pool 240 tall holding two 120 lanes is resized to 100. `childPoses` gives the slack (−140) to the last lane only, clamped to MIN_LANE_SIZE: lane 1 stays 0..120, lane 2 becomes 120..160, both past the pool's 100 bottom; `childPoses` cannot change the bounds, and nothing else grows the pool back or shrinks earlier lanes. The lane stack's own invariant ("the pool's size along the stack is the sum of its lanes", file header) no longer holds.
- evidence: read
- severity: low

## A point on a region's header/body edge is both the header (title edit) and the body (insert target)
- where: packages/diagram/src/containers/containerTitle.ts:36 (regionHeaderAt) vs packages/diagram/src/containers/canDropInto.ts:98 (diagramDropParentAt)
- scenario: container at y 0 with a 28 header; a point at local y = 28. `regionHeaderAt` tests `headerBox` with closed `rectContainsPoint`, so a double-click there edits the title; `diagramDropParentAt` tests `bodyBox` with half-open `rectContainsPointHalfOpen`, so an insert there lands in the body. The same edge is answered two ways; one of the two tests should be half-open on the shared edge.
- evidence: read
- severity: low

## A pool drawn narrower than its header gets lanes of negative width
- where: packages/diagram/src/containers/regionSpecs.ts:95-97 (firstLanes); same arithmetic in containerStencils.ts:109-111 (addLane)
- scenario: a pool stencil (axis y, header 32) dragged 20 wide: `placedBounds` keeps the 20×H box (both sides > 0), and `firstLanes` gives each lane `width: at.width - header.size` = −12. `bodyBox`/`headerBox` clamp the header to the box (`Math.min`), giving a body of width 0, so the stored lanes disagree with the box the layout and hit tests use until a layout pass rewrites them; a negative-width rect is also handed to the renderer and to `titlePose` for each lane's title. Should clamp to the body (`Math.max(0, …)` / use `bodyBox`).
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

<!-- done: 6 findings, files read: 12 -->
