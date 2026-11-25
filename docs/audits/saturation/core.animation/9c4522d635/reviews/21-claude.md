# core.animation findings

## coastByWrite leaves its preview installed and records nothing when its decay is canceled from outside
- where: packages/core/src/animation/behaviors/coastByWrite.ts:41 (coastByWrite, `coast.stop` / no cancel watch)
- scenario: a flick coasts over an adapter with `previewPoses` and no `poseTarget`; mid-coast the animator's `cancelAll` runs (or the canvas unmounts, or something calls `cancelKey` on the `momentum:N` key). `table.retire` emits a `cancel` event and never calls `onDone`, so `commitFlick` never runs: the nodes stay shown at their last preview pose, the document keeps the pre-drag pose, and no `flick` op is recorded. `coast.stop` later only deletes the coast ("it stopped long ago and somewhere else") and still does not clear the preview. `coastOnTargets` answers the same event the other way: it watches for `cancel`/`interrupt`, halts each rider and records the flick (coastOnTargets.ts:157). Expected: the write path clears its preview and commits where the coast stopped, as the targets path does.
- evidence: read (animator `table.retire` emits `{ type: 'cancel' }`, table.ts:171; offsetTween's cancel path calls no `onDone`)
- severity: medium

## coastByWrite under `boundary: 'stop'` never ends early when a dragged id has no release pose
- where: packages/core/src/animation/behaviors/coastByWrite.ts:27 and :95 (coastByWrite, `riding` / the every-stopped check)
- scenario: `riding` is every `ctx.draggedIds` entry the adapter holds, but a node absent from `ctx.current` has no `startPoses` entry, so `onTick` hits `if (!start) continue` before it can ever join `stopped`. Once every node that does move has met an edge, `[...riding].every((id) => stopped.has(id))` stays false, so the coast keeps running until the decay dies out, and the flick is recorded only then rather than at the edge. `momentum.onEnd` only requires *some* dragged id to be in `ctx.current`, so this mix reaches here. Expected: ids with no start pose are left out of `riding` (as `targetsOf` leaves them out of the targets path).
- evidence: read
- severity: low

## momentum asks for pose targets with a different descriptor from the one it coasts by
- where: packages/core/src/animation/behaviors/momentum.ts:99 (targetsOf)
- scenario: with no `poseDescriptor` option, `d` is `AUTO_POSE_DESCRIPTOR` and every bound, clamp and translation in the coast goes through it. `targetsOf` passes `opts.poseDescriptor` (undefined) to `adapter.poseTarget`, which over a scene falls to `scenePoseTarget`'s `RECT_POSE_DESCRIPTOR`. A path-posed node therefore gets a target whose axes come from the rect descriptor (or the generic `axesOf` fallback), while `poseVelocity` and the edge clamp translate it through AUTO's path branch. The two ways of answering "how does this pose move" can then disagree. If no axes come back, the whole drag silently falls back to `coastByWrite`, and additive coasting is lost. Expected: pass `d` to `poseTarget`.
- evidence: read (inference about the per-node effect; RECT vs AUTO defaults are read)
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
