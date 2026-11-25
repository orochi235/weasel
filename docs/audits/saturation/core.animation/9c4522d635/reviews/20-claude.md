# core.animation findings

## A coast on pose targets records another writer's pose as the flick when the pose target stops its decay
- where: packages/core/src/animation/behaviors/coastOnTargets.ts:166 (the `animator.watch` in `coastOnTargets`), with packages/core/src/animation/poseTarget.ts:108-119 (`build`'s `show` and its overrides subscription)
- scenario: a node is flicked over a scene adapter, so it coasts on its `scenePoseTarget`. Mid-coast, a gesture other than a move (a resize or rotate handle) commits a new pose for it, and the commit clears that gesture's preview override. `build`'s overrides subscription sees `overwritten()` and calls `target.stop({ commit: false })`. That retires the decay through `table.retire` (packages/animator/src/engine/core.ts:90-92), which emits a `'cancel'` event (packages/animator/src/engine/table.ts:168-171). The coast's watch can't tell that event apart from an outside `cancelAll`, so it calls `halted(r)`. That sets `r.seen` to the other writer's pose, so `ours(r)` is true. `commitFlick` → `flickOps` then commits `ctx.origin` over the other writer's pose and records a `'flick'` op from the pre-drag pose to that pose. The momentum docs say a node another writer moves mid-coast "drops out of the coast where that left it, and nothing is recorded for it". Instead the other gesture's result is recorded a second time as a flick, which also clears the redo stack. The `drop` path, which should handle this case, never runs, because `tick` is not called again after the stop.
- evidence: read (the stop → retire → 'cancel' path is read; the order relative to the next tick is inferred)
- severity: medium

## A coastByWrite coast canceled from outside stays in the behavior's `coasts` set
- where: packages/core/src/animation/behaviors/coastByWrite.ts:42-54 (`coast.stop`), with packages/core/src/animation/behaviors/momentum.ts:91 (`coasts`)
- scenario: the adapter has no pose targets. A flick's decay is canceled by `cancelAll` or a cancel on its key, and neither `onDone` nor `commitFlick` runs. The only code that removes the coast from `coasts` is `coast.stop`'s early branch, which runs only when a later drag's `onStart` includes one of that coast's ids. In an app that cancels animations on, say, every tool switch, each canceled flick of a node that is never dragged again keeps its `Coast` in `coasts` for the life of the behavior. That includes its closure's `startPoses`, `lastSeen` and `finalPositions` maps, so the set has no bound. coastOnTargets removes itself on an outside cancel through its watch. Leaving the preview in place is ruled in `docs/unruled.md:1730`; keeping the entry in the set is not.
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
