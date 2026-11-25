# core.animation findings

## coastByWrite never hears an outside cancel: its previews stay up, the flick is never committed, and the coast stays in `coasts`
- where: packages/core/src/animation/behaviors/coastByWrite.ts:42 (coast.stop) and :59 (animator.decay)
- scenario: an adapter with `previewPoses` but no `poseTarget`; flick a node, then `animator.cancelAll()` (or the canvas's animator is torn down) mid-coast. A canceled decay calls neither `onTick` again nor `onDone`, and unlike `coastOnTargets` (which subscribes `animator.watch` for 'cancel'/'interrupt') nothing here listens. So `commitFlick` never runs: the last `previewPoses` frame stays installed indefinitely (the node is drawn at the coast position while the document still holds `ctx.origin`, so picks and drawing disagree), no 'flick' op is recorded, and the `Coast` stays in the behavior's `coasts` set. A later drag of the node reaches `stop()`, whose "not active" branch only deletes the coast — it still neither clears the previews nor commits. The comment there ("it stopped long ago and somewhere else") holds for coastOnTargets, where the watch committed it, not here. Should: watch for the decay's cancel as coastOnTargets does and run `commitFlick` (or at least clear the previews).
- evidence: read (compared with coastOnTargets.ts:160-163; animator tween/decay calls `onDone` only on natural end, tweenAnimation.ts:70-78)
- severity: high

## momentum's default descriptor is answered two ways: AUTO for translating, RECT for the pose targets
- where: packages/core/src/animation/behaviors/momentum.ts:82 and :115 (targetsOf)
- scenario: `momentum({ animator })` with no `poseDescriptor`. `d` is `AUTO_POSE_DESCRIPTOR`, which coastOnTargets uses for `translatePoseViaDescriptor`, `getBounds` and `poseVelocity`; but `targetsOf` passes `opts.poseDescriptor` (undefined) to `adapter.poseTarget`, so `scenePoseTarget` builds the target with `RECT_POSE_DESCRIPTOR` axes. For a pose AUTO describes and RECT does not (a path/polygon pose, a pose with a transform), the velocity is computed in AUTO's terms against axes RECT (or the flat-field fallback) made, and the first target made for that node is fixed with RECT for every later caller ("read the first time a node's target is made"). Should pass `d` to `poseTarget`.
- evidence: read
- severity: medium

## A skinned node's baked (and shown) path is world-space but stored as `data.path` under a rotated pose, so a rotated node's rotation is applied twice
- where: packages/core/src/animation/rig/skinBinding.ts:87-88 (show) and :99-100 (write)
- scenario: a skinned node whose pose has `rotation` ≠ 0. `dataRestPath` returns `pathInWorld(data.path, pose)`, i.e. with the pose frame (rotation) already baked in; `skinPath` bends that world path; `write` stores it as `data.path` with pose `descriptor.fromBounds(boundsOfPath(path), restPose)`, which keeps `restPose`'s rotation. `kit:path` then draws `data.path` through `pathInPoseBox` (identity here) and `poseFrameOf(pose)`, rotating it again about its center. After `rig.bake()` the node is drawn turned by twice its rotation; the live override (`entry.path` + same pose) shows the same if overrides' paths are drawn as `data.path` is. Should un-apply the pose frame (or write a pose with rotation zeroed) before storing.
- evidence: read pathInWorld.ts:58-67; that the renderer reads an override `path` the way it reads `data.path` is inference
- severity: medium

## The coasts' "still ours" test compares only unrotated bounds, so a rotation-only write by another writer is overwritten
- where: packages/core/src/animation/behaviors/coastOnTargets.ts:75 (ours), packages/core/src/animation/behaviors/coastByWrite.ts:32 (stillOurs)
- scenario: a node coasting after a flick; mid-coast an undo, or another tool, changes only its rotation (or any pose field that does not move `getBounds`, e.g. a transform about the center that the descriptor's bounds ignore). `sameBounds` still matches, so the coast keeps treating the node as its own: coastByWrite writes `translatePoseViaDescriptor(start, …)` from the release pose, putting the old rotation back, and both record a 'flick' op whose `to` discards the other write. The momentum docs promise "a node something else moves … an undo included, drops out of the coast where that left it, and nothing is recorded for it."
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

<!-- done: 4 findings, files read: 26 -->
