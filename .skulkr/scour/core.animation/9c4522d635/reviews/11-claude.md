## coastByWrite leaves its preview installed and the flick unrecorded when its decay is canceled from outside
- where: packages/core/src/animation/behaviors/coastByWrite.ts:44 (coastByWrite, `coast.stop`; no cancel watch)
- scenario: over an adapter with `previewPoses` and no `poseTarget`, flick a node, then `animator.cancelAll()` (or unmount the canvas's animator) mid-coast. A canceled decay never calls `onDone`, so `commitFlick` never runs: the `previewPoses` override stays at the last coast frame while the document still holds the pre-drag pose, no `flick` op is recorded, and the coast stays in the behavior's `coasts` set, holding its ctx, until a later drag of one of its ids reaches `stop`. That `stop` then sees `!isActive` and only deletes it, never clearing the preview. `coastOnTargets` handles the same case with `animator.watch` for `cancel`/`interrupt` and halts there; this path should do likewise: commit (or at least clear `previewPoses` with nulls) when its decay is canceled.
- evidence: read (onDone not fired on cancel per the animator; `coastOnTargets.ts:157` watches for this case and this file does not)
- severity: medium

## useRigNode ignores a change of `descriptor`: the skeleton stays placed by the old one
- where: packages/core/src/animation/rig/rigNode.ts:183 (sameRefs) and :216-219 (useRigNode)
- scenario: render `useRigNode({ scene, node, descriptor: A })`, then rerender with `descriptor: B`, the scene unchanged. `read` runs again and places the skeleton through B, but `refs` holds only nodes, poses, data and skins, so `sameRefs(held, next)` is true. `parts` stays `held`, and the rig keeps the skeleton placed through A (`placeSkeleton` reads `descriptor.getBounds`). Meanwhile `useSeatedRig` gets the new `descriptor` and rebinds with it, so the bind/apply descriptor and the skeleton placement disagree. The same applies to a `scene` change whose nodes happen to be the same objects. The comparison should also take in the inputs that `read` depends on beyond the refs (descriptor, scene).
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
