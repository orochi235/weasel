## coastByWrite leaves its preview installed and the flick unrecorded when its decay is canceled from outside
- where: packages/core/src/animation/behaviors/coastByWrite.ts:42 (coastByWrite, `coast.stop` / no cancel watch)
- scenario: a flick coasts over an adapter with `previewPoses` but no `poseTarget`; mid-coast `animator.cancelAll()` runs (an unmount, a reset). A canceled decay never calls `onDone`, and unlike `coastOnTargets` (which subscribes `animator.watch` for `cancel`/`interrupt` and halts its riders) `coastByWrite` has no watch, so `commitFlick` never runs: the nodes keep showing the coast's last preview frame while the document still holds the pre-drag pose, no `flick` op is recorded, and the coast stays in the behavior's `coasts` set holding the gesture context. A later drag of one node reaches `stop()`, which sees the key inactive and only deletes the coast, still without clearing the preview. Over a `setPose`-only adapter the node is left moved in the document with no history entry. Should end as `coastOnTargets` does: clear the preview (or commit) and record the flick where it stopped.
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

<!-- done: 1 findings, files read: 26 -->
