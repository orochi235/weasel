## coastByWrite leaves its preview on screen and its coast registered when the decay is canceled from outside
- where: packages/core/src/animation/behaviors/coastByWrite.ts:46 (coast.stop) and :63 (animator.decay, no cancel watch)
- scenario: an adapter with `previewPoses` but no `poseTarget`; flick a node, then `animator.cancelAll()` (or the canvas unmounts) mid-coast. A canceled decay never calls `onDone`, and unlike `coastOnTargets` this path has no `animator.watch` for cancel/interrupt, so `commitFlick` never runs: the last `previewPoses` frame stays shown over a document still holding the pre-drag pose, no flick op is recorded, and the `Coast` stays in the behavior's `coasts` set. `stop()` only notices later, if the same node is dragged again, and then just deletes the coast — it still never clears the preview (`previewPoses(null)` per id) or records the move. Should: on outside cancel, commit the flick where it stopped (as `coastOnTargets` does) or at least clear the preview.
- evidence: read (compared against coastOnTargets.ts:160-163, which watches for exactly this case)
- severity: medium

## animateOnSetPose / animateLifecycle return a spread copy, dropping an adapter's prototype methods and getters
- where: packages/core/src/animation/wrappers/animateOnSetPose.ts:63 and packages/core/src/animation/wrappers/animateLifecycle.ts:47 (`{ ...adapter, ... }`)
- scenario: an adapter written as a class instance (methods on the prototype, e.g. `class StoreAdapter { getPose() {…}; applyOps() {…}; poseTarget() {…} }`). Object spread copies only own enumerable properties, so the wrapped result has no `getPose`, `applyOps`, `poseTarget`, `getNode`, … — the wrapper's own `setPose` then throws on `adapter.getPose` only through the inner reference, while every other caller of the wrapped adapter finds the methods missing; a getter is frozen at its wrap-time value. The docs promise "the result is the adapter it was given, with that one method replaced", which holds only for plain object literals.
- evidence: read (inference about consumer adapter shape; the type `PoseAnimationAdapter` does not require an object literal)
- severity: low

## A momentum coast on pose targets runs under its own key, not `pose:<id>`, so `cancelKey`/`isActive`/`pauseKey` on the node miss it
- where: packages/core/src/animation/behaviors/coastOnTargets.ts:93 (`cancelKey` from `coastKey()`), vs poseHelpers.ts:63 / tweenPose docs
- scenario: `tweenPose`'s docs say every move of a node's pose shares `pose:<id>` for `cancelKey`, `pauseKey` and `isActive`. A node coasting after a flick on a scene-backed adapter moves its pose target under `momentum:N`, so `animator.isActive('pose:a')` answers false while the node visibly travels, and `animator.pauseKey('pose:a')` / `cancelKey('pose:a')` leave the coast running. The same question (which key a node's pose motion answers to) is answered two ways.
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
