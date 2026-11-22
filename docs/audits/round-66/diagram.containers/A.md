## A pool's lane order is decided two ways: `lanesOf` sorts by start edge, while `laneStackLayout` and the theme sort by middle
- where: packages/diagram/src/containers/containerStencils.ts:84 (lanesOf), against packages/diagram/src/containers/laneStack.ts:65-67 (lanesOf in laneStackLayout) and theme/themeWrites.ts:54 (laneIndex, "by its middle … as laneStackLayout orders them")
- scenario: `addLane(scene, pool, k)` centers a 120-unit lane on the boundary before lane k (start = boundary − 60). If lane k−1 is less than 60 along the stack (e.g. one at MIN_LANE_SIZE 40), the new lane's start sorts before lane k−1's, but its middle (the boundary) sorts after it. The same split shows up for any stored lanes that overlap (data-built, or not yet restacked). `lanesOf` then feeds `poolLanesOf`/`poolsOf`, which index the boundary affordances, `laneResizeFrame` ("every later lane" shifts) and release's "lanes after it" lock check, in an order different from the one the layout stacks and the theme colors by. A resize of "lane k−1" can shift the wrong lanes, and the lock check can look at the wrong ones. The two places should share one ordering rule.
- evidence: read
- severity: medium

## `diagramDropParentAt` never asks a consumer's `canReparent` about an insert: an empty id list skips it
- where: packages/diagram/src/containers/canDropInto.ts:48 (diagramCanDropInto) with :100 (diagramDropParentAt, `childVerdict(..., [], verdict)`)
- scenario: a host builds `canDropInto = diagramCanDropInto(scene, canReparent)` with a `canReparent` that vetoes container X, and passes it to `diagramDropParentAt`. The insert probe calls the verdict with `ids = []`, and `[].every(parent === X)` is vacuously true, so the function returns `true` without calling `canReparent`. X becomes the insert's parent even though the consumer's "last word" refuses anything moving into it. A move of real nodes into X is refused, but an insert lands there.
- evidence: read
- severity: low

## `addLane` names an inserted lane `Lane ${count+1}` wherever it goes
- where: packages/diagram/src/containers/containerStencils.ts:124 (addLane)
- scenario: a pool has `Lane 1` and `Lane 2`. `addLane(scene, pool, 0)` puts a new first lane titled `Lane 3` above `Lane 1`, so the titles no longer follow the stack order, which is the order the default titles (`firstLanes`) and the doc ("in the order they stack") promise.
- evidence: read
- severity: low

## Release refuses when any lane of the pool is locked, even a lane the release does not write
- where: packages/diagram/src/containers/containerStencils.ts:158-159 (releasePlan)
- scenario: a pool with lanes A (locked), B and C. Releasing C's members should write only C's members, the pool and its title, since no lane comes after C. But `restacked` includes every lane of the pool (`membersOf(beside)`) and checks each with `isLocked`, so a locked A, which sits before C and does not move, makes `canReleaseMembers(C)` false. The lanes that do move are already checked on the next line (`lanes.slice(indexOf + 1)`).
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
