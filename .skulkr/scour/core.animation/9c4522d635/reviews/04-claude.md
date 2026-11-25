# core.animation — blind review findings

## coastByWrite leaves its preview overrides installed, and the flick unrecorded, when its decay is canceled from outside
- where: packages/core/src/animation/behaviors/coastByWrite.ts:42 (coast.stop) and :59 (animator.decay call)
- scenario: a pose with no axes makes `momentum` coast through `coastByWrite` on `moveGestureAdapter` (which has `previewPoses`). Mid-coast, `animator.cancelAll()` runs (an unmount, a view reset) or something calls `animator.cancelKey('momentum:N')`. The untargeted decay has no `onCancel` (`DecayOptions` in packages/animator/src/types.ts:148 has only `onDone`), and a canceled animation never calls `onDone`, so `commitFlick` never runs. Unlike `coastOnTargets`, which watches `animator.watch` for `cancel`/`interrupt` and halts its riders, `coastByWrite` subscribes to nothing. The result: every carried node keeps the last coast frame's `previewPoses` override in `scene.overrides`, which nothing clears. The node is painted and picked at the coasted position while the document holds the pre-drag pose, and no flick op is recorded. A later `coast.stop()` (dragging the node again) sees `!animator.isActive(cancelKey)` and only removes the coast from the set; it still clears no preview. The coast also stays in the behavior's `coasts` set until one of its nodes is dragged again, so flicks that are canceled and never re-dragged pile up there. It should either clear the previews and record the flick where the decay stopped, as `coastOnTargets` does, or at least clear the previews.
- evidence: read (coastByWrite.ts, coastOnTargets.ts:162-167, animator DecayOptions, editing/src/actions/move/gestureAdapter.ts previewPoses)
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
