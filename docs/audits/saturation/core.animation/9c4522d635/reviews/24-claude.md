## coastByWrite never hears an outside cancel: the preview stays on screen and the flick is never recorded
- where: packages/core/src/animation/behaviors/coastByWrite.ts:41 (coastByWrite, `coast.stop` / no watch)
- scenario: a flick over an adapter with `previewPoses` and no `poseTarget` is coasting when `animator.cancelAll()` runs (or the canvas's animator is torn down). A canceled decay never calls `onDone`, and coastByWrite has no `animator.watch` for `cancel`/`interrupt` (coastOnTargets has one for exactly this case, lines 160-166). So `commitFlick` never runs: the last coast frame stays installed through `previewPoses` indefinitely, the document still holds the pre-drag pose (the move action's own commit was suppressed by `momentum.onEnd` returning null), and no history entry is written. The coast also stays in `coasts` until a later drag of one of its ids, where `stop()` sees the key inactive and deletes it, still without clearing the preview or committing. Over a `setPose`-only adapter the node is left at the last written pose with no op recorded. It should do what coastOnTargets does: commit where it stopped and clear the preview. The same outside cancel is handled two different ways on the two coast paths.
- evidence: read
- severity: medium

## Both coasts decide "still ours" by bounds alone, so a rotation-only write mid-coast is folded into the flick
- where: packages/core/src/animation/behaviors/coastOnTargets.ts:79 (`ours`); packages/core/src/animation/behaviors/coastByWrite.ts:33 (`stillOurs`)
- scenario: a node coasts, and something else writes a pose that differs only in a field `getBounds` does not reflect. Examples are a rotation (RECT/AUTO `getBounds` gives the unrotated box), an undo of a rotation, or any non-bounds pose field. `sameBounds` still matches, so the coast keeps treating the node as its own. In coastOnTargets, `flickOps` takes `to = target.committed()`, which now includes the other writer's rotation, commits `from` (the pre-drag origin) back, and records origin → to as the flick. The other writer's change gets merged into the flick entry, and undoing the flick reverts it. The momentum doc says a node something else writes mid-coast "drops out of the coast where that left it, and nothing is recorded for it". coastByWrite has the same blind spot.
- evidence: read
- severity: low

## scenePoseTarget remakes a resting node's target whenever a caller passes a descriptor with a different axis count, contrary to its doc
- where: packages/core/src/animation/poseTarget.ts:204 (scenePoseTarget)
- scenario: the doc says `descriptor` "is read the first time a node's target is made" and that the target is "the same one on every call". But the held target is reused only if `poseAxes(by, …)?.count === held.axisCount`, where `by` is the *current* call's descriptor. Take two callers on one node, one using the default RECT descriptor (e.g. `momentum` with no `poseDescriptor`, or `tweenPose` with no `geometry`) and one passing a `geometry` whose `axes` gives a different count. Each lookup at rest throws away the other's target and builds a new one from its own descriptor. Which descriptor governs a node then depends on who asked last, not on who asked first.
- evidence: read
- severity: low

## useRigNode keeps the old skeleton placement when `descriptor` changes
- where: packages/core/src/animation/rig/rigNode.ts:225 (useRigNode, `sameRefs`)
- scenario: a component re-renders `useRigNode` with a new `descriptor` and the same scene. The `useMemo` re-reads and `placeSkeleton` places the skeleton through the new descriptor. But `sameRefs` compares only the node, pose, data and skin references, which have not changed, so `parts` stays `held`. The rig keeps the skeleton placed by the old descriptor, while `useSeatedRig` receives the new `descriptor` for `apply` and skins. The joints end up where the old descriptor put them until some unrelated edit under the rig makes the refs differ.
- evidence: read
- severity: low

## bindRig binds one node to two joints without complaint; the second override silently wins
- where: packages/core/src/animation/rig/bindRig.ts:178 (bindRigOn)
- scenario: `bindings: { arm: ['n1'], hand: ['n1'] }`. A node that is both bound and skinned throws (line 181), but a node listed under two joints is pushed twice. Each frame installs two overrides on `n1`, and the later `hand` one shadows `arm`. `bake` writes both poses in sequence, so the last one wins. The `arm` binding is dropped with no error, unlike the bound-and-skinned conflict, which is refused.
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

<!-- done: 5 findings, files read: 26 -->
