## diagramCanDropInto admits any insert into a pool: an empty `ids` passes the lanes-only rule vacuously
- where: packages/diagram/src/containers/canDropInto.ts:37-41 (diagramCanDropInto, `allowed`)
- scenario: core asks with `ids = []` for every insert and paste (`insertParent` / `takingPage` in packages/core/src/canvas/deps/insertParent.ts:18,35 via `admitsChild(scene, into, [], canDropInto)`). With an `insertInto`/`pasteInto` naming a pool, `ids.every(lane && same side)` is `true` on an empty array, so a rectangle or pasted shape is parented directly under the pool. The doc says "a pool takes only lanes". `laneStackLayout` sees only ids and poses, so it then stacks the shape as a lane (resized to the body width, absorbs the pool's size as the last lane). The answer should be `false` for a pool when `ids` is empty, as `diagramDropParentAt` already assumes (it never offers a pool).
- evidence: read
- severity: medium

## Releasing a pool deletes any member of the pool that is not a lane
- where: packages/diagram/src/containers/containerStencils.ts:188 (releasePlan)
- scenario: `members = membersOf(pool).flatMap(membersOf)` keeps only the children of the pool's children. A pool child that is not a lane, such as a shape inserted into the pool by the path in the finding above or one from imported data, contributes only its own children (none for a shape). `scene.remove(pool)` then deletes it with the pool, although the doc says Release members "keeps what it holds".
- evidence: read
- severity: low

## The pool header is decided two ways: laneStackLayout uses a fixed default, while addLane and restackLocked read the trait's header
- where: packages/diagram/src/containers/laneStack.ts:67 (laneStackLayout `header`); packages/diagram/src/containers/containerStencils.ts:114,153 (restackLocked, addLane)
- scenario: the registered layouts are built with `poolHeader(axis)` (size 32) and ignore `data.diagram.container.header`. `addLane` puts the new lane at `bodyBox(b, trait.header)`, and `restackLocked` predicts the stack with `trait.header ?? poolHeader(axis)`. For a pool whose trait header has a different size, the new lane is placed off from where the layout then stacks it. The lock check compares lanes against positions the layout never uses, so it can call a shifted lane unshifted, or the reverse.
- evidence: read
- severity: low

## A new pool's first lanes can overflow the pool box they are built in
- where: packages/diagram/src/containers/regionSpecs.ts:96 (firstLanes); packages/diagram/src/containers/containerStencils.ts:64-68 (containerBuild)
- scenario: each lane is `max(MIN_LANE_SIZE, along / n)`. A pool dragged out 60 high with the default two lanes, or a stencil with many `lanes` titles, gets lanes that add up to more than the pool's `at.height` (2 × 40 = 80 > 60). The pool spec keeps `at` unchanged, so the inserted pool is smaller than its lane stack until a layout `fit` happens to run (inference: I did not trace whether insert runs `fit`).
- evidence: read (overflow); inference (whether a later fit corrects it)
- severity: low

## The lane actions check locks and build the preview on `opts.scene` but commit to `ctx.deps.scene`
- where: packages/diagram/src/containers/containerActions.ts:203-221 (createAddLaneAction), 164-188 (createLaneResizeAction), 59-64 (commitLaneResizeToScene)
- scenario: `addLaneLocked(opts.scene, …)` gates the click, but the default commit runs `addLane` on `ctx.deps.scene`. The resize previews `laneResizeFrame(opts.scene, …)` and the default commit recomputes the frame from `ctx.deps.scene`. When the contribution is built with a scene other than the canvas's `scene` dep (for example a wrapped or remounted scene), the lock check and the preview describe one scene while the write lands in another.
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

<!-- done: 5 findings, files read: 12 -->
