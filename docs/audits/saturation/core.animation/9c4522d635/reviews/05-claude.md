## coastByWrite leaves its preview up and records nothing when its decay is canceled from outside
- where: packages/core/src/animation/behaviors/coastByWrite.ts:46 (coast.stop) and :63 (decay start; no cancel watch)
- scenario: an adapter with `previewPoses` (no `poseTarget`) is flicked; mid-coast `animator.cancelAll()` runs (or the canvas unmounts its animator, or `cancelKey` hits it). The animator skips `onDone` on cancel (`engine/context.ts:46`), so `commitFlick` never runs: the last `previewPoses` frame stays installed while the document still holds the pre-drag pose (the move action's own commit was suppressed by `return null`), and the flick is never recorded. The coast also stays in `coasts` until a later drag of one of its ids hits `stop()`, whose not-active branch again only deletes it, still without clearing the preview or committing. `coastOnTargets` answers the same case the other way: it `animator.watch`es for its decay's cancel/interrupt and halts and records (`coastOnTargets.ts:162`). Should commit the reached position (or at least clear the preview) on an outside cancel.
- evidence: read (animator cancel skips onDone confirmed in packages/animator/src/engine/context.ts:46)
- severity: medium

## A node that has dropped out of a multi-node coast still stops the whole coast when dragged again
- where: packages/core/src/animation/behaviors/momentum.ts:114 (onStart), coastByWrite.ts:43 / coastOnTargets.ts:146 (`ids: ctx.draggedIds.slice()`)
- scenario: flick A and B together; mid-coast B is moved by another writer (a tween, an undo) and drops out of the coast (`riding.delete` / `riders.delete`). The user then drags B. `onStart` matches against the coast's frozen `ids`, which still name B, so `coast.stop()` ends A's coast early and records it where it stands, though A is untouched by the new drag. `ids` should track the nodes still riding.
- evidence: read
- severity: low

## coastOnTargets adopts another animation's commit as its own when that animation interrupts its decay, and records it as the flick
- where: packages/core/src/animation/behaviors/coastOnTargets.ts:162 (watch) → :101 (halted) → :51 (flickOps)
- scenario: a coasting node gets `springPose` (which interrupts moves on the node and has already committed and recorded its own `to`). The watch sees the decay's `interrupt` and calls `halted(r)`, which sets `r.seen = r.target.committed()` — the spring's destination. `ours(r)` then passes, so `flickOps` commits the drag origin back onto a target the spring is still running on and records a second op `origin → spring.to` labeled `flick`. The documented behavior is that a node another writer moves leaves the coast unrecorded (momentum.ts:62); here history gets two entries for the same move and the document is rewritten under a live spring. The interrupt path should `drop` the rider rather than `halt` it. (Assumes the spring interrupts the decay on the shared target, which the watch's `interrupt` branch exists to catch.)
- evidence: read; inference on the animator's interrupt-by-target behavior
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
