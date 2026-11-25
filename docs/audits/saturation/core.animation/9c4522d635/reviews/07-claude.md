## coastByWrite leaves an externally canceled coast's preview installed and records nothing, where coastOnTargets records the flick
- where: packages/core/src/animation/behaviors/coastByWrite.ts:42 (coastByWrite, `coast.stop` / decay with no cancel watch)
- scenario: a momentum flick over an adapter with `previewPoses` but no `poseTarget`; mid-coast the animator's `cancelAll` (or an unmount's cancel) ends the decay. A canceled decay never calls `onDone`, and coastByWrite does not watch for the cancel, so `commitFlick` never runs: the last coast frame stays installed through `previewPoses` indefinitely, no `flick` op is written (the move action's own commit was suppressed by `return null`), and the coast sits in `coasts` until the node is dragged again, when `stop` sees it inactive and just drops it — the preview is never cleared, and the next drag starts from the document's pre-drag pose while the node is shown elsewhere. Over a `setPose`-only adapter the node is left mid-coast in the document with no history entry. coastOnTargets answers the same event the other way: its `animator.watch` hears the cancel, halts the rider and records the flick "as for any other stop". Should match: clear the preview and commit the flick where it stood.
- evidence: read
- severity: medium

## scenePoseTarget rebuilds a resting node's target whenever a caller passes a different descriptor, contrary to "read the first time"
- where: packages/core/src/animation/poseTarget.ts:205 (scenePoseTarget)
- scenario: a node's target is made with descriptor D1 (say a custom one mapping 5 axes); later `momentum`'s `targetsOf` (which passes `opts.poseDescriptor`, usually undefined → `RECT_POSE_DESCRIPTOR`, 4 axes) asks for the same node. `poseAxes(by, …)` is computed with the *caller's* descriptor, its count differs from `held.axisCount`, so the held target is discarded and a new RECT one is cached; the D1 caller's next lookup flips it back. The JSDoc says the descriptor "is read the first time a node's target is made", and the shape-change check was meant for a pose that changed shape, not for a different descriptor. Two callers alternate rebuilding the node's target, and a target one of them still holds is no longer the cached one, so later moves through the other do not add to it (and its `onRest` can delete the newer cached entry). Compare against the descriptor the held target was built with.
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

<!-- done: 2 findings, files read: 26 -->
