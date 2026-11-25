## coastByWrite never hears an outside cancel: the coast's last preview frame stays on screen and the flick goes unrecorded
- where: packages/core/src/animation/behaviors/coastByWrite.ts:59 (coastByWrite, the `animator.decay` call; `coast.stop` at :43)
- scenario: a flick over an adapter with `previewPoses` but no `poseTarget` is coasting when `animator.cancelAll()` runs (or the canvas unmounts, or something cancels the coast's `momentum:N` key). The value-form decay takes no `onCancel` (`DecayOptions` in packages/animator/src/types.ts has none) and the coast installs no `animator.watch`, so `commitFlick` never runs: `previewPoses` is never handed the `null`s that clear it, so the nodes stay painted at the coast's last frame while the document still holds the pre-drag pose, and no `flick` op is recorded. The coast also stays in the behavior's `coasts` set until a later drag of one of its ids calls `stop()`, which only takes it out. It should clear the preview and record where the nodes stopped, as `coastOnTargets` does through its `animator.watch` cancel handler (coastOnTargets.ts:150-153).
- evidence: read
- severity: medium

## A `Rig` that has been rebound on the same seat still shows through its own dropped binding from `place()` and `pose()`, which leaves overrides nothing clears
- where: packages/core/src/animation/rig/bindRig.ts:228-237 (bindRigOn, `rig.pose` / `rig.place`)
- scenario: `useRigNode` keeps one `RigSeat` across rebinds (rigNode.ts:229-235), so each rebind returns a new `Rig` object, and `useSeatedRig`'s cleanup drops the old binding (useRig.ts:24-28). Say a caller still holds the earlier `Rig` (captured in a callback or an IK loop) and calls `place(m)` on it, or `pose(p)` while the target is animating. Either call runs the old closure's `show` directly, not `seat.binding.show`. That reinstalls the old `Bound` entries' overrides next to the new binding's and sets the old `installed` to true. The new binding never clears those entries, and the old binding's `drop` has already run, so the nodes keep showing the stale entries until that old rig's `release()`/`bake()` is called. The `target.commit` path already goes through `seat.binding` (via the seat target's `show`), so the two paths decide "which binding shows" in two different ways. Both should show through `seat.binding`.
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
