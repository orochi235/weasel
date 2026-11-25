## A by-write coast canceled from outside leaves its last preview frame on screen and records nothing
- where: packages/core/src/animation/behaviors/coastByWrite.ts:42 (coastByWrite, `coast.stop`; no cancel watch)
- scenario: drag a node over an adapter with `previewPoses` but no `poseTarget`, flick it, and call `animator.cancelAll()` (or unmount the canvas's animator) mid-coast. The animator skips `onDone` for a canceled animation (`engine/context.ts:46`), and unlike `coastOnTargets` (which watches for `cancel`/`interrupt` and halts, `coastOnTargets.ts:159`) this coast has no watch. So `commitFlick` never runs: the preview from the last `onTick` stays installed, no `flick` op is written, and the coast sits in `coasts` until a later drag of the same node hits the early return in `stop`, which deletes it without clearing the preview. Expected: the same as the target path, where the node halts where it was shown, the flick is recorded and the preview is cleared.
- evidence: read
- severity: medium

## A skinned node that is rotated gets rotated twice, both while the rig is posed and in what `bake` writes
- where: packages/core/src/animation/rig/skinBinding.ts:87 (bindSkins `show`), :97 (`write`)
- scenario: a node with a `skin` and a pose whose `rotation` is non-zero. `rest` is `dataRestPath`, i.e. `pathInWorld(data.path, pose)`, which already applies the pose's rotation (`geom/src/paths/pathInWorld.ts:61-67`). `show` puts the bent world path into `entry.path` and sets `entry.pose = descriptor.fromBounds(boundsOfPath(path), restPose)`, which keeps `restPose`'s rotation. The painter draws an override `path` in its pose box and then turns it by the pose frame, as it does for `data.path` (`canvas/derivedPath.ts`). So the already-rotated path is turned again about its center. `write` stores the same world path as `data.path` with that rotated pose, so the double rotation is baked into the document. Expected: convert back through the pose frame first, which is what `worldEditToStorage(pose, worldPath)` in the same geom file does. At rotation 0 the two agree, which is why unrotated tests pass.
- evidence: read (the paint path's handling of override paths is inferred from `derivedPath.ts` and `buildSceneLayer.ts:34`, not run)
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
