I couldn't write `.skulk/out/findings.md` because permission to write it was denied, so the whole document is below. I dropped the stuck-preview finding for `coastByWrite.ts` because `docs/unruled.md:1502` already rules on it. The `coastOnTargets.ts` finding below is the pose-target path, which that ruling doesn't cover.

```markdown
# Audit round 37 — core.animation

## animateLifecycle removes a node re-inserted while its exit animation runs
- where: packages/core/src/animation/wrappers/animateLifecycle.ts:61 (removeNode / insertNode)
- scenario: with `exitTo` set, `removeNode('a')` starts the exit tween and adds `a` to `leaving`. Within `ms`, the caller inserts a node with id `a` again (an undo of the delete, a paste, a re-add). `insertNode` neither clears `leaving` nor cancels the pending removal. Over an adapter with `poseTarget`, the exit tween (`interrupt: false`) runs on to `onDone` → `remove()` → `adapter.removeNode('a')`, deleting the freshly inserted node. Over an adapter without one, the enter tween shares `pose:a` and interrupts the exit tween, and the watch's `interrupt` branch calls `remove()` at once. Either way the re-inserted node vanishes. It should stay, and the stale removal should be dropped.
- evidence: read
- severity: medium

## momentum's pose-target coast writes the document with no history entry after an outside cancel
- where: packages/core/src/animation/behaviors/coastOnTargets.ts:126 (coast.stop / commitFlick)
- scenario: flick a node over a scene-backed adapter (pose targets), then call `animator.cancelAll()` mid-coast. Each canceled decay commits the pose it reached, which `scenePoseTarget.set` writes untracked into the document (see the comment at line 116). But `onDone`/`halted` never run, so `commitFlick` never records the flick op. The document keeps a mid-coast pose with no undo entry, because `onEnd` returned null and suppressed the drag's own commit. Undo goes straight back to the op before it, and the coast stays in `coasts`. This is a different case from the ruled one (docs/unruled.md:1502, previewPoses without targets): here the document itself changes, not just a preview.
- evidence: read
- severity: medium

## scenePoseTarget keeps, and keeps returning, the target of a node deleted while at rest
- where: packages/core/src/animation/poseTarget.ts:186 (scenePoseTarget)
- scenario: animate node `a` once, which caches its target in `sceneTargets`. Let it come to rest, then delete `a`. The cache entry is only dropped from `onRest` when the node is already gone, so it survives. A later `scenePoseTarget(scene, 'a')` computes `fits = … || !node` as true and returns the held target, though its doc says "Undefined for a node that is not in the scene". Through `sceneToAdapter().poseTarget`, `tweenPose`/`springPose` on the deleted id then record a set-pose op and run an animation whose `set` silently does nothing. `sceneClipTargets` binds `pose:a` to the dead target. Every node animated and later deleted at rest stays in the per-scene map for the scene's lifetime, so the map grows without bound as nodes come and go.
- evidence: read
- severity: medium

## rigFromNode writes skins into a plain object keyed by node id, so a `__proto__` id is lost
- where: packages/core/src/animation/rig/rigNode.ts:116 (read)
- scenario: a child node under a rig node has id `__proto__` and a `data.skin`. `out.skins[child] = skin` sets the object's prototype instead of an own key, so `bindRig`'s `Object.entries(skins)` never sees it and the skin is silently not bound (`Object.hasOwn(options.skins, node)` also misses it). The bindings table in the same function uses `getOwn`/`setOwn`, and the skins table should too.
- evidence: read
- severity: low

## A skinned node with a rotated pose is baked with its rotation applied twice
- where: packages/core/src/animation/rig/skinBinding.ts:91 (bindSkins write), :86 (show)
- scenario: skin a node whose pose has `rotation` r. `dataRestPath` returns the path through `pathInWorld`, rotation included, so the bent path is in world space. `show`/`write` then pose it with `descriptor.fromBounds(boundsOfPath(path), restPose)`, which keeps `restPose.rotation`, and `write` stores the world path in `data.path`. Painting `data.path` through that pose rotates it by r again, so after `bake()` the node is drawn turned 2r. Expected: the stored path and pose together reproduce the bent world path (for example via `worldEditToStorage`). I inferred this from reading `pathInWorld`/`pathInPoseBox` and did not run it. It depends on `fromBounds` keeping rotation.
- evidence: read (inference)
- severity: low

## rewindingTween ends a leg early under an overshooting easing
- where: packages/core/src/animation/rewind.ts:71 (rewindingTween leg)
- scenario: `tweenPose(…, { rewind: true, easing: 'easeOutBack' })`, undone and then redone at a moment where `ease(at / ms) >= 1`, which happens because an overshooting easing passes 1 before `ms`. The forward leg's guard `done >= 1` treats the move as already at `to`: it stops the target and calls `onDone` with time still left, so the node snaps instead of traveling. In the other direction, `easeInBack` gives `done <= 0` near the start on the way back and ends that leg early too.
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

<!-- done: 6 findings, files read: 25 -->
```

<!-- done: 6 findings, files read: 25 -->