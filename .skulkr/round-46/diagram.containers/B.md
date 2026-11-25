# Audit round 46 — diagram.containers

Note: the brief names frozen commit 6438325dbfdd…, which this checkout does not have (`git cat-file` reports a bad
object). Everything below was read from the tree as checked out (HEAD 782733b19c).

## Growing a lane past the lanes after it reorders the pool's lanes on commit
- where: packages/diagram/src/containers/containerActions.ts:49 (commitLaneResizeToScene), with packages/diagram/src/containers/laneStack.ts:66-67,104-112 (laneStackLayout lanesOf / childPoses)
- scenario: a pool of rows with lanes A (y 0, height 100) and B (y 100, height 100). Drag A's boundary down 250 → size 350. The preview (`laneResizeFrame`) shows A at 350 with B shifted below it. The commit writes only A's height (350) and the pool's height (450); the layout pass then runs `childPoses`, which orders lanes by their *midpoints* in the stored poses: A's mid is 175, B's (still at y 100) is 150, so it stacks B first and A second. The committed result puts B above A, unlike the preview. It happens whenever the growth `d` exceeds the lane's old size plus the next lane's size. The commit should write the later lanes' shifted poses too (as the preview does), or the stack should order by start, not mid.
- evidence: read (traced `runLayoutPass` in packages/core/src/core/scene/layoutPass.ts: a resized child queues its parent, whose `childPoses` re-sorts by `mid`)
- severity: medium

## regionHeaderAt tests a stored (parent-local) header box against a world point
- where: packages/diagram/src/containers/containerTitle.ts:29 (regionHeaderAt)
- scenario: diagram scenes store a lane in its pool's frame (`addLane` builds the lane "in the pool's own frame"; `poolsOf` reads `pose` and `at` separately). For a pool at world (500, 300), a lane is stored at (32, 0, …). Double-clicking the lane's header at world (545, 350) computes `headerBox(node.pose)` = x 32..60, which does not hold x 545, so the lane is skipped; the walk then tests the pool, whose header is x 500..532, also a miss, and the action declines. So any nested region's title (every lane's, and a container's inside another) cannot be edited by double-click unless its parent sits at the origin, and a double-click whose world point happens to fall in a nested region's *local* header box picks a region it is not over. The header box should be built from the node's world pose (`worldWith(scene)` / `scenePoseFrame(scene).world`).
- evidence: read
- severity: medium

## diagramDropParentAt composes poses through envelope nodes, which the composition fold skips
- where: packages/diagram/src/containers/canDropInto.ts:76 (diagramDropParentAt walk)
- scenario: the walk composes every child with its parent's world (`compose(frame, pose)`) regardless of whether the parent defines a frame. An envelope (a node with `derivePose`/`dependsOn`, e.g. a boolean group) does not define one: its children are stored in the frame above it and "the composition fold passes over it" (`definesFrame`, packages/core/src/core/scene/effectivePose.ts:364). A container under an envelope at (200, 0) is therefore computed 200 units right of where it draws, so a stencil drawn inside it lands at the top level (or in a container it is not over). Should skip composing for parents where `definesFrame` is false, as `localizeWorldPoses` and `carriedDescendants` do — or read world poses through `scenePoseFrame`.
- evidence: read
- severity: low

## diagramCanDropInto lets a lane move into a pool stacking along the other axis
- where: packages/diagram/src/containers/canDropInto.ts:37 (diagramCanDropInto allowed)
- scenario: a pool's rule is only `ids.every(roleOf === 'lane')`. A lane is built for its pool's axis — its header (`laneHeader(axis)`: left for rows, top for columns) and its layout key (`diagram:lane-rows` vs `diagram:lane-columns`) are baked into its data. Dragging a lane from a pool of columns into a pool of rows is allowed and the lane keeps a top header and the columns layout: its title and members' drop region sit along the top of a row lane, while every sibling's header is on the left. The verdict should require the lane's header side to match the target pool's axis (`poolAxisOf`), or the move should rewrite the lane's header and layout.
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

<!-- done: 4 findings, files read: 12 -->
