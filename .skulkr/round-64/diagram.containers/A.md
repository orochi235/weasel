I couldn't write `.skulkr/out/findings.md` because the write permission was refused, so the whole document is below.

# Audit round 64: diagram.containers (blind reviewer)

Note: the brief's frozen commit 49e5a07e6aecc7037a5e3692706cf28dd58211c4 is not in this clone (`git cat-file` fails). I read the tree at HEAD 6f634fabe1, where no file under `packages/diagram/src/containers/` has local changes.

## Resizing a lane in a turned pool moves the whole pool
- where: packages/diagram/src/containers/containerActions.ts:61-68 (commitLaneResizeToScene), and the preview that matches it at :90 (laneResizeFrame, `grow(pool.pose, d)`)
- scenario: take a pool of rows turned a quarter (`rotation: π/2`) and drag lane 1 30 units longer.
  - The commit writes the pool's stored pose as `{ ...p, height: p.height + d }`, keeping `x, y`.
  - A `RectPose` turns about its center (`poseFrameOf` rotates about `x + w/2, y + h/2`). Growing the height moves the center by d/2 along unturned y, so the drawn start corner moves by d/2·(I − R)ŷ: (15, 15) world units here.
  - The lanes are stored in the pool's frame (`boxFrameOf`, with its origin on that corner). Every lane, title and member moves with it, and the boundary ends up away from the pointer that dragged it.
  - The pool's start edge should stay put. Core's layout pass keeps it there when a strategy returns new bounds (`layoutPass.ts` `apply` remaps through `at.upright`).
  - The test "grows a lane by a drag along its turned pool's stack" checks only the lane's height.
- evidence: read (geometry worked by hand, not run)
- severity: medium

## A lane resize moves locked nodes inside the later lanes
- where: packages/diagram/src/containers/laneBoundaryLayer.ts:79-82 (laneResizeLocked); also containerActions.ts:128 (resize `start`)
- scenario: a pool has lanes A and B, and a shape inside B is locked.
  - Dragging A's boundary shifts B, and B carries the locked shape with it because the shape is stored in B's frame.
  - `laneResizeLocked` checks only the lanes and the two titles, not what the shifted lanes hold.
  - Core's `reachesLocked` rule (ruled 2026-11-09) refuses any move whose subtrees reach a locked node.
  - So the boundary should not be offered here, and `start` should return `{}`. `start` calls the same function, so it has the same gap.
- evidence: read
- severity: medium

## Releasing a lane moves locked members of the lanes after it
- where: packages/diagram/src/containers/containerStencils.ts:141-147 (releasePlan)
- scenario: a pool has lanes A, B and C, with a locked shape inside C.
  - Releasing A removes it, and the pool's `depart` moves B and C up by A's size. C's locked shape moves with C.
  - `reachesLocked` covers only the released lane. `restacked` checks the pool, its title and the lanes themselves, but not what the lanes hold.
  - The release should be refused, as `reachesLocked` over the restacked lanes would refuse it.
- evidence: read
- severity: medium

## Shrinking a pool below its lanes leaves the lanes hanging out of it
- where: packages/diagram/src/containers/laneStack.ts:104-112 (laneStackLayout childPoses)
- scenario: a pool of rows is 240 tall, with lanes of 120 and 120. Resize the pool to 100 with the selection handles.
  - `childPoses` puts the slack (−140) on the last lane and clamps it at `MIN_LANE_SIZE`. The lanes come out 120 and 40, 160 in all, so 60 units of lane draw past the pool's bottom edge.
  - That breaks the module's own contract that "the pool's size along the stack is the sum of its lanes".
  - The strategy has no `fit` to return the bounds it needs, so the pool stays smaller than what it holds.
- evidence: read
- severity: medium

## `addLane` throws on a negative or fractional index
- where: packages/diagram/src/containers/containerStencils.ts:104 (addLane)
- scenario: call `addLane(scene, poolId, -1)` or `addLane(scene, poolId, 1.5)`.
  - The guard checks only `index >= lanes.length`, so `lanes[-1]` is `undefined` and `scene.get(undefined)!.pose` throws a TypeError.
  - The exported signature takes `index?: number` with no stated range. It should clamp, or treat any out-of-range index as "at the end", the way it already treats an index past the end.
- evidence: read
- severity: low

## `addLane` with an explicit style leaves the later lanes striped for their old places
- where: packages/diagram/src/containers/containerStencils.ts:120-123 (addLane)
- scenario: in a themed scene, call `addLane(scene, poolId, 0, style)`.
  - The new lane takes `style`, but the theme restripe is skipped entirely (`style === undefined && …`).
  - The lanes it pushes along by one keep the stripe colors of their old places, and the next theme apply repaints them as an edit the user never made.
  - The style should decide only the new lane's colors. The lanes after it should be restriped either way.
- evidence: read
- severity: low

## Hidden lanes still offer a resize boundary
- where: packages/diagram/src/containers/laneBoundaryLayer.ts:60-75 (poolsOf) and :161-171 (createLaneAffordance)
- scenario: one lane of a visible pool is hidden on its own.
  - `poolsOf` skips a hidden pool but lists every lane in it. The hidden lane still gets a boundary region and a `row-resize` cursor over empty canvas.
  - Dragging that boundary resizes a lane nobody can see.
  - Elsewhere the diagram treats hidden nodes as off-limits (`diagramDropParentAt`, `childVerdict`).
- evidence: read
- severity: low

## The drop-parent search misses a container that overhangs its parent's body
- where: packages/diagram/src/containers/canDropInto.ts:96-103 (diagramDropParentAt, walk)
- scenario: container B sits inside container A and has been dragged partly past A's edge, which free placement (`diagramContainerLayout`) allows.
  - An insert at a point inside B's body but outside A's skips B. Once the point misses A's body, the walk `continue`s past A's whole subtree.
  - The insert lands at the top level instead of in B, which is drawn right under the pointer.
  - The doc promises "the innermost container or lane whose body holds `point`". The walk should still descend into such a region, just without counting the region itself.
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

<!-- done: 8 findings, files read: 12 -->