# Audit round 66 — diagram.containers

## Lane order is answered two ways: `lanesOf` sorts by start edge, `laneStackLayout` and the theme by middle
- where: packages/diagram/src/containers/containerStencils.ts:84 (lanesOf), vs packages/diagram/src/containers/laneStack.ts:67 (lanesOf in laneStackLayout) and theme/themeWrites.ts:54 (laneIndex, "as laneStackLayout orders them")
- scenario: lanes whose boxes overlap: a pool loaded or edited with unstacked lanes, or during `addLane`, which places the new lane centered on its boundary (start = boundary − 60). Take a 40-tall lane at y=200..240 followed by `addLane(scene, pool)`: the new lane starts at 180, before the old lane's 200, so `lanesOf` puts it first, while the layout and the theme (mid 240 > 220) put it last. Everything built on `lanesOf` (`poolLanesOf` → boundary affordances and `laneResizeFrame`'s "later lanes", `releasePlan`'s later-lane lock check, `regionSync`, `addLane`'s `lanes[index]`) then indexes a different stack from the one the layout draws and the theme colors. It should use the same ordering key (middle along the axis) as the layout.
- evidence: read
- severity: low

## `addLane` drops the pool's lane styles in an unthemed scene
- where: packages/diagram/src/containers/containerStencils.ts:124 (addLane), packages/diagram/src/containers/containerActions.ts:197 (default commitAddLane)
- scenario: a pool built by `containerBuild` with `laneStyles.bodies` (lanes colored in turn) in a scene with no `DIAGRAM_THEME_KEY`. Clicking add-lane runs `addLane(scene, poolId)` with no style, so the new lane gets `DEFAULT_NODE_STYLE` and not the next body style in the cycle. Only a themed scene recolors it. The pool's colors depend on which path created a lane.
- evidence: read
- severity: low

## `addLane` with an `index` moves later lanes without checking locks
- where: packages/diagram/src/containers/containerStencils.ts:99 (addLane)
- scenario: `addLane(scene, pool, 0)` when lane 2 is locked. The new lane arrives and the pool's `arrive` restacks every lane after it, moving the locked lane (and its title, and theme `update`s on the lanes) in the "Add lane" batch. Only the action checks locks (`addLaneLocked`, end of stack only), and the public function does no lock check of any kind. `releaseMembers` and the resize do refuse to write locked nodes.
- evidence: read
- severity: low

## `diagramDropParentAt` calls the scene composition's `compose` detached from its object
- where: packages/diagram/src/containers/canDropInto.ts:87 (diagramDropParentAt)
- scenario: `const compose = scene.composition?.compose;` and then `compose(frame, pose)`. A consumer `PoseComposition` written as a class, or as an object whose `compose` uses `this` (for example to read a `decompose` or config field), gets `this === undefined` and throws, or composes wrongly, on the first nested region. Everywhere else (`laneResizeFrame`'s `pc.compose`) calls it as a method. The built-in `RIGID_POSE_COMPOSITION` uses plain functions, so it does not hit this.
- evidence: read
- severity: low

## `laneScratchOf` throws on a hit whose payload is `null`
- where: packages/diagram/src/containers/laneBoundaryLayer.ts:46 (laneScratchOf)
- scenario: `payloadOf` returns `hit.payload` as-is, so `{ payload: null }` yields `null`. `null !== undefined` passes, and `payload.poolId` throws a TypeError inside the resize `start` or the add-lane `run`, when it should return null and pass the gesture on.
- evidence: read
- severity: low

## A pool drawn shorter than its lanes' minimum gets lanes that overflow it
- where: packages/diagram/src/containers/regionSpecs.ts:92 (firstLanes), packages/diagram/src/containers/containerStencils.ts:53 (containerBuild)
- scenario: a pool stencil dragged 60 tall with the default two lanes. Each lane is `max(MIN_LANE_SIZE, 30) = 40`, so they run from y to y+80. The pool spec keeps height 60, and so does its title, which is built from the same `at`. The insert ops leave the lanes drawn 20 past the pool and the left-header title short of them, unless a later layout fit grows the pool. `containerBuild` should size the pool to the lanes' total, as `laneStackLayout.resized` does.
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
