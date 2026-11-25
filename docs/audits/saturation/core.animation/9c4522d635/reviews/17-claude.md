# core.animation findings

## coastByWrite never ends a coast its decay lost to an outside cancel: preview left on screen, flick unrecorded, coast kept in the set
- where: packages/core/src/animation/behaviors/coastByWrite.ts:42 (coast.stop) and :63 (animator.decay, no cancel watch)
- scenario: a flick over an adapter with `previewPoses` but no `poseTarget` is coasting when `animator.cancelAll()` runs (or the canvas's animator is torn down on unmount). The decay is canceled, so `onDone` never fires and `commitFlick` never runs. The adapter keeps showing the last coast frame through `previewPoses` while the document still holds the pre-drag pose, and no `flick` op is recorded. The next pick or commit then reads a pose other than the one on screen. The `Coast` stays in `coasts`, holding `ctx` and the adapter, until a later drag of one of its ids calls `stop()`. That call takes the `!animator.isActive` branch, which only removes the coast from the set and never clears the preview. Over a `setPose`-only adapter, the document is left at the last frame with no undo entry. `coastOnTargets` handles the same case with `animator.watch` on cancel/interrupt (coastOnTargets.ts:163) and commits the flick where the decay stopped. coastByWrite has no such watch, so the two coast paths settle an outside cancel two different ways.
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
