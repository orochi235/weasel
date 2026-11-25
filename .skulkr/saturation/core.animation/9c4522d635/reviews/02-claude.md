## A rotated skinned node is bent and baked with its rotation applied twice
- where: packages/core/src/animation/rig/skinBinding.ts:82 (bindSkins show) and :94 (write)
- scenario: a skinned node whose pose has `rotation` (or a `transform`). `dataRestPath` returns `pathInWorld(path, pose)`, which maps the path into the pose box and then turns it by `poseFrameOf(pose)`, so `rest` and every `skinPath` result are already in world space. `show` and `write` then pair that world path with `descriptor.fromBounds(boundsOfPath(path), s.restPose)`, which keeps the rest pose's rotation, and `write` stores the world path as `data.path`. Painted through `pathInWorld` again, the path is turned a second time about the new box's center: the bent/baked node is drawn rotated by 2× its rotation. Should convert back to storage space (`worldEditToStorage` in `@weasel-js/geom` exists for exactly this) or drop the rotation from the pose.
- evidence: read (pathInWorld.ts:58-68; the override path being painted through the pose is inferred from `kit:path` painting `data.path` the same way)
- severity: medium

## scenePoseTarget's shape check reads the caller's descriptor, not the one the target was built with
- where: packages/core/src/animation/poseTarget.ts:205 (scenePoseTarget)
- scenario: the doc says `descriptor` "is read the first time a node's target is made", but at rest the held target is kept only if `poseAxes(by, …).count === held.axisCount`, where `by` is this call's descriptor (RECT when omitted). A node first targeted by `tweenPose(…, { geometry: polygonDescriptor })` and then by `momentum` (which passes `opts.poseDescriptor`, usually undefined → RECT) or an `animateOnSetPose` without geometry gets a count mismatch, so a fresh target replaces it in the table. Whoever still holds the old target (a reflow, a rewind leg, a coast rider started from it) is then a second target over one node, and the two no longer add; alternating callers rebuild the target on every call. The check should compare against the descriptor the held target was made with.
- evidence: read
- severity: medium

## coastByWrite never ends a 'stop' coast early when a dragged id has no release pose
- where: packages/core/src/animation/behaviors/coastByWrite.ts:72-96 (onTick)
- scenario: `momentum.onEnd` coasts when only *some* of `ctx.draggedIds` are in `ctx.current`. An id in `draggedIds` but not `ctx.current` (and present in the adapter) is put in `riding` and `lastSeen`, but every tick hits `if (!start) continue` before `stopped.add`, so under `boundary: 'stop'` `[...riding].every(stopped.has)` is never true. After every real node meets an edge, the coast keeps running and rewriting held poses each frame until the decay dies out on its own, and the flick's commit waits for it. The id should be left out of `riding` (as `coastOnTargets` does, building riders only from `targets`).
- evidence: read
- severity: low

## animateLifecycle's exit watcher can be registered after the exit already finished
- where: packages/core/src/animation/wrappers/animateLifecycle.ts:99-116 (removeNode)
- scenario: `unwatch` is the no-op placeholder while `tweenPose` runs; the real `animator.watch` is installed only after it returns. If the exit tween settles during that call (ms 0 under `prefers-reduced-motion`, where `defaultMotionMs()` is 0, if the animator completes a zero-length tween at start), `onDone → remove()` runs, calls the placeholder, removes the node, and then a watcher is installed for an animation that will never cancel: one listener leaked per removal. Install the watch before starting the tween, or skip it when `leaving` no longer holds `removeNow`.
- evidence: read; whether the animator completes a 0 ms tween synchronously is inferred, not checked
- severity: low

## useRigNode throws from render for a node under the rig that has a skin but no path
- where: packages/core/src/animation/rig/rigNode.ts:156-160 (read) → skinBinding.ts:66 (bindSkins)
- scenario: `read` binds any child whose data has a `skin` (or whose painted map names it) without checking it has a `data.path`; `bindSkins` then throws "has no path to skin" inside `useSeatedRig`'s `useMemo`, taking the component down. `rigFromNode`'s contract is to leave out what the document names inconsistently (dangling joints are skipped with a warning); a skin left on a node whose path was removed or that was converted to another kind should be skipped the same way, not crash the canvas.
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
