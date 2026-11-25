# Audit findings: core.animation

## A coast over an adapter with no pose targets, canceled from outside, leaves its preview on screen and loses the drag
- where: packages/core/src/animation/behaviors/coastByWrite.ts:56 (coastByWrite: decay `onDone`, `coast.stop`)
- scenario: drag a node on an adapter with `previewPoses` but no `poseTarget`, release it fast enough to coast, then `animator.cancelAll()` (canvas unmount) or `animator.cancelKey('momentum:N')`. A canceled physics animation skips `onDone` (`packages/animator/src/engine/context.ts:46`), so `commitFlick` never runs. `previewPoses` keeps showing the coasted pose and is never cleared. No op is written. The move action's own commit was already suppressed when `momentum.onEnd` returned `null`, so the document stays at the pre-drag pose and the drag is lost from history. The coast also stays in `coasts` until the next drag's `onStart` finds it inactive. `coastOnTargets` handles the same case with `animator.watch` for `cancel`/`interrupt` (coastOnTargets.ts:157) and commits the flick. Expected: commit the flick at the last pose it reached and clear the preview, the way the target path does.
- evidence: read
- severity: medium

## Baking a skinned node writes a world-space path into `data.path`, whatever `restPath` read it from
- where: packages/core/src/animation/rig/skinBinding.ts:91 (bindSkins: `write`)
- scenario: `rest` comes from `restPath(node)`. The default `dataRestPath` returns `pathInWorld(data.path, pose)`: rebased to the pose box, then turned by the pose's rotation/transform frame. `write` stores the bent world path in `data.path`, and stores a pose from `descriptor.fromBounds(bounds, restPose)`, which keeps `restPose`'s rotation. On the next paint `pathInWorld` applies that rotation a second time, so a rotated skinned node shows turned twice after `rig.bake()`. An unrotated node comes out right. Separately, a caller-given `restPath` that reads the path from somewhere other than `data.path` still has the result written into `data.path`, so that option is ignored on the bake path. Expected: unplace the bent path into the node's own frame (the inverse of what `restPath` did), and write it where `restPath` reads. (The double rotation is my reading of `pathInWorld`/`pathInPoseBox`. I did not run it.)
- evidence: read
- severity: medium

## `Rig.world()` ignores the seat's placement until the rig is next shown
- where: packages/core/src/animation/rig/bindRig.ts:180 (bindRigOn: `let world = restWorlds`)
- scenario: `useRigNode` rebinds on a seat that keeps `root`, the placement given through `rig.place(root)` or `rig.pose(p, root)`. For a seat whose pose is not on screen (`seat.shown` false, so `seatBinding` does not call `show`), the new rig's `world()` answers `restWorlds` with no root applied. The docs promise "root applied". The same holds for any rig bound on a placed seat before its first `show`. Expected: `world` starts as `restWorlds` multiplied by `seat.root` when the seat has one.
- evidence: read
- severity: low

## Files read
packages/core/src/animation/behaviors/coast.ts
packages/core/src/animation/behaviors/coastByWrite.ts
packages/core/src/animation/behaviors/coastOnTargets.ts
packages/core/src/animation/behaviors/momentum.ts
packages/core/src/animation/clipTargets.ts
packages/core/src/animation/departures.ts
packages/core/src/animation/index.ts
packages/core/src/animation/motionMs.ts
packages/core/src/animation/pathMotion.ts
packages/core/src/animation/poseHelpers.ts
packages/core/src/animation/poseTarget.ts
packages/core/src/animation/poseTransition.ts
packages/core/src/animation/reflow.ts
packages/core/src/animation/reflowGlide.ts
packages/core/src/animation/rewind.ts
packages/core/src/animation/rig/bindRig.ts
packages/core/src/animation/rig/index.ts
packages/core/src/animation/rig/rigNode.ts
packages/core/src/animation/rig/rigSeat.ts
packages/core/src/animation/rig/skinBinding.ts
packages/core/src/animation/rig/useRig.ts
packages/core/src/animation/wrappers/animateLifecycle.ts
packages/core/src/animation/wrappers/animateOnSetPose.ts
packages/core/src/animation/wrappers/index.ts
packages/core/src/animation/wrappers/instantPose.ts
packages/core/src/animation/writtenPoseTarget.ts

<!-- done: 3 findings, files read: 26 -->
