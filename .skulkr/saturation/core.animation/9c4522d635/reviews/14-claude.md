## coastByWrite never hears an outside cancel: preview left installed, flick never recorded, coast leaks in the set
- where: packages/core/src/animation/behaviors/coastByWrite.ts:42 (coastByWrite, `coast.stop` and the missing cancel watch)
- scenario: a flick coasts over an adapter with no `poseTarget` but with `previewPoses`; mid-coast the animator's `cancelAll()` runs (or the canvas's animator is torn down / `cancelKey` reaches it). A canceled decay never calls `onDone`, and coastByWrite registers no `animator.watch` / `onCancel`, so `commitFlick` never runs: the last `previewPoses` frame stays on screen over a document that still holds the pre-drag pose, no `flick` op is applied, and the `Coast` stays in the behavior's `coasts` set. Only a later drag of the same node reaches `stop()`, which then sees `!isActive` and just deletes it, still without clearing the preview. coastOnTargets answers the same event the other way: it watches `cancel`/`interrupt` and records the flick where the node halted. Should: clear the preview and record (or at least clear) on an outside cancel, as coastOnTargets does.
- evidence: read (tweenAnimation's "a canceled tween never completes"; coastOnTargets.ts:157 watches for this, coastByWrite has no equivalent)
- severity: medium

## useRigNode throws during render once its rig node leaves the scene
- where: packages/core/src/animation/rig/rigNode.ts:146 (read), called from useRigNode's useMemo at :215
- scenario: a component renders `useRigNode({ scene, node: 'rig' })`; the user deletes the rig node, or undoes its insertion. The scene version bumps, the memo reruns `read`, and `read` throws `rigFromNode: the rig is node "rig", which the scene lacks.` during render, so the tree crashes unless an error boundary catches it. A node under the rig going away is skipped quietly (`if (!n) continue`) and a bound node deleted after binding is skipped in `show`, so only the rig node itself crashes. Should: release the rig (or return an inert one) when the node is gone.
- evidence: read
- severity: medium

## useRigNode ignores a change of `descriptor` while the scene's refs are unchanged
- where: packages/core/src/animation/rig/rigNode.ts:221 (useRigNode, `sameRefs(held, next)`)
- scenario: the caller passes a new `descriptor` (for example switching from AUTO to a custom one) without any scene edit. `next` is re-read with the new descriptor, so `placeSkeleton` puts the joints somewhere else, but `sameRefs` only compares node, pose and data refs, finds them equal, and keeps `held`, whose skeleton was placed by the old descriptor. The rig is then rebound (`useSeatedRig` gets the new `descriptor`) over a skeleton the new descriptor did not place. Should: count the descriptor in the comparison (or in `refs`).
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
