# Findings: diagram.containers (round 67)

## addLane in a themed scene restyles locked lanes that its lock check passed over
- where: packages/diagram/src/containers/containerStencils.ts:166 (addLane), with restackLocked at :105
- scenario: themed scene, pool with lanes A, B, and A is locked. `addLane(scene, pool)` (or the add-lane button) appends a lane. `addLaneLocked` → `restackLocked(kept=[A,B], moved=[])` reports nothing locked, because A is not shifted. Then the batch passes every lane (`new Set([id, ...lanes])`) to `themeWrites`. `paintBox` gives a non-null write for any lane that has a stroke, which every lane has, and `paintText` gives one for each lane's title, so `scene.update` writes A's data and A's title's data. The function's contract and the 2026-11-21 ruling (docs/unruled.md:3618) say a call that would restyle a locked node changes nothing. Only the new lane and the lanes after it should be restyled, which the comment above the call also says, and the lock check should cover whatever is restyled.
- evidence: read (themeWrites.ts:186–237, paintBox at :107)
- severity: medium

## restackLocked compares round-tripped float poses exactly, so a locked lane that stays put still blocks the add
- where: packages/diagram/src/containers/containerStencils.ts:115-119 (restackLocked), with poolBox `inBox` at :99
- scenario: a pool at a fractional or far-from-origin position (e.g. x = 1e6 + 0.1, or 0.1), first lane stored exactly at {x: 32, y: 0}, and that lane locked. `inBox` runs `RIGID_POSE_COMPOSITION.decompose(box, frame.world(id))`, i.e. (X + 32) − X, which is not exactly 32 in floating point. `p.x !== to.x` then counts the lane as shifted, `reachesLocked` sees it locked, and `addLaneLocked` returns true. The add-lane button disappears and `addLane` returns null, though nothing locked would move. A rotated pool hits the same thing through the sin/cos round trip. The comparison needs a tolerance, or should be made on stored poses.
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
