# core.animation findings

## A coast over an adapter without pose targets that is canceled from outside leaves its preview on screen and records nothing
- where: packages/core/src/animation/behaviors/coastByWrite.ts:42 (coastByWrite, `coast.stop`; no cancel watch)
- scenario: drag-and-flick a node on an adapter with `previewPoses` but no `poseTarget`, then `animator.cancelAll()` (or the canvas's animator is torn down) mid-coast. The decay is canceled, so `onDone` never runs and `commitFlick` is never called. The node's preview stays at the last coast frame indefinitely, while the document still holds the pre-drag pose (so picking and the document disagree with what is drawn), and no flick op is recorded. The coast also stays in `coasts` until some later drag of the same id calls `stop()`, and that `stop()` sees `!isActive` and only deletes it, leaving the preview in place again. `coastOnTargets` handles the same case with `animator.watch` on cancel/interrupt (see its lines 162–165). `coastByWrite` should do the same: commit, or at least clear its previews, when its decay is canceled from outside.
- evidence: read
- severity: medium

## `bindRig`'s `bake` writes a skinned node's world-space path into `data.path`, so a rotated or transformed node is drawn rotated twice
- where: packages/core/src/animation/rig/skinBinding.ts:97 (bindSkins → `write`), with `show` at :83
- scenario: a skinned node whose pose has `rotation` (or a `transform`). `rest` is `dataRestPath(node)` = `pathInWorld(data.path, pose)`, which is world space with the pose's frame already applied, so `skinPath` gives a world path. `show` puts it in the override as `entry.path`, and that is correct, because an override path is "already where it is drawn" (pathPainter.ts:31). `write()`, however, stores the same world path as `data.path` and sets the pose to `descriptor.fromBounds(boundsOfPath(path), restPose)`, which keeps the rest pose's rotation/transform. The painter then runs `pathInWorld(data.path, pose)`, fitting the path to the box and rotating it by the pose's frame a second time. After `rig.bake()` the node jumps to a doubly rotated shape. It should go through `worldEditToStorage(pose, worldPath)` the way pathLeaf.ts and editablePath.ts do. Unrotated nodes come out right only because the fit-to-box is an identity there.
- evidence: read
- severity: medium

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

<!-- done: 2 findings, files read: 26 -->
