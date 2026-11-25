# core.animation — blind review findings

## coastByWrite never hears an outside cancel: the preview stays up, the flick goes unrecorded, the coast stays in `coasts`
- where: packages/core/src/animation/behaviors/coastByWrite.ts:61 (coastByWrite, `animator.decay` call; compare coastOnTargets.ts:162 `animator.watch`)
- scenario: a coast over an adapter without `poseTarget` is running when `animator.cancelAll()` runs or the canvas's animator unmounts. The decay is canceled, which calls neither `onTick` nor `onDone`, so `commitFlick` never runs. Over a `previewPoses` adapter the last coast frame stays previewed forever, because `previewPoses(null)` is never sent, and the document keeps the pre-drag pose. Over a `setPose`-only adapter the document holds the last written pose with no op, because the move's own commit was suppressed by `return null`, so undo cannot return it. Either way the coast stays in `coasts` until a later drag of one of its ids calls `stop()`, which then only deletes it. coastOnTargets handles the same case through a cancel/interrupt watch that halts and commits. coastByWrite should do the same: on a cancel of its key, run `commitFlick`.
- evidence: read
- severity: medium

## A skinned node with a rotated pose is rotated twice: the bent world-space path is shown and baked under a pose that keeps the rest rotation
- where: packages/core/src/animation/rig/skinBinding.ts:91 (bindSkins.show) and :103 (bindSkins.write)
- scenario: `dataRestPath` returns `pathInWorld(data.path, pose)`, which already applies the pose's box mapping and its rotation/`transform` frame (geom/src/paths/pathInWorld.ts:58–67). `show` puts that world path in `entry.path` with `entry.pose = descriptor.fromBounds(boundsOfPath(path), s.restPose)`. `fromBounds` keeps the template's non-bounds fields, so a rotated `restPose` keeps its rotation. The path is painted through `pathInPoseBox` and then through `poseFrameOf(pose)` again, so a node at rotation θ shows its path at 2θ from the first frame, before any joint moves. `bake` writes the same world path into `data.path` under that rotated pose, so the document is left double-rotated. Unrotated nodes are unaffected, since the box mapping there is the identity.
- evidence: read (pathInWorld composition); the renderer painting an override `path` through the pose frame is inferred from pathInWorld's comment that it shares `pathInPoseBox` and `poseFrameOf` with the renderer
- severity: medium

## A coast interrupted by springPose records the interrupter's destination as the flick and writes the document back to the drag origin under it
- where: packages/core/src/animation/behaviors/coastOnTargets.ts:162 (unwatch watch → halted) with :106 (halted) and :52 (flickOps)
- scenario: a node coasts on its scene pose target, and a `springPose` of it (interrupting, default) records its op first (document := spring `to`) and then interrupts the decay. The watch calls `halted(r)`, which sets `r.seen = target.committed()`, now the spring's `to`. Because of that, `ours(r)` is true, and `flickOps` calls `r.target.commit(origin)`, writing the pre-drag pose to the document while the spring runs on the same target. It then applies a `flick` op from origin to the spring's `to`. The momentum doc says a node something else moves "drops out of the coast where that left it, and nothing is recorded for it". Instead history gains a second entry for the spring's destination, and the target's committed pose is yanked back to the origin mid-spring. `halted` from the watch should keep `seen` as the coast last left it, so `ours` fails for an interrupt from another writer.
- evidence: read; the order of interrupt versus the spring's own commit inside `@weasel-js/animator` is inferred
- severity: low

## animateOnSetPose and animateLifecycle drop every prototype method of a class-based adapter
- where: packages/core/src/animation/wrappers/animateOnSetPose.ts:56 and packages/core/src/animation/wrappers/animateLifecycle.ts:46 (`...adapter`)
- scenario: both docs say the result "is the adapter it was given, with that one method replaced", but `{ ...adapter }` copies only own enumerable properties. An adapter written as a class (`getPose`, `getNode`, `poseTarget`, `applyOps` on the prototype) comes back without them. The wrapped adapter then throws `getPose is not a function` when used, and an optional member such as `poseTarget` silently disappears, so `tweenPose` callers given the wrapper fall back to per-frame `setPose`. Getters are also frozen at their wrap-time value.
- evidence: read
- severity: low

## useRigNode throws during render when its rig node is deleted
- where: packages/core/src/animation/rig/rigNode.ts:168 (read), called from useRigNode's `useMemo` at :222
- scenario: a component holds `useRigNode({ scene, node: 'rig' })`, and the user deletes the rig node, or undoes its creation. The scene version bumps, `read` runs in render, and it throws `rigFromNode: the rig is node "rig", which the scene lacks.` That crashes the subtree on an ordinary document edit. The hook's own doc says it rebinds "when nodes under it come or go", but it has no path for the rig node itself going. The same applies when an edit removes `data.skeleton`.
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
