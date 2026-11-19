Note: the brief names frozen commit aac71b545ef36621a62610a7cc0bf3665162b2e5, which this clone does not hold (`git cat-file` reports a bad object). The checkout is at 7095f874ee84ae7fc8454ba425cb6ba5ac5bbbe8, and these findings are against that tree.

## scenePoseTarget answers a stale target for a node deleted at rest, and its cache keeps one per such node forever
- where: packages/core/src/animation/poseTarget.ts:186 (scenePoseTarget)
- scenario: tween a node with `tweenPose`, `animateOnSetPose`, a momentum flick or a `pose:<id>` clip track; let it come to rest; then delete the node. `held` is set and `node` is undefined, so `fits` is true (`|| !node`) and `scenePoseTarget(scene, id)` keeps returning the old target. The doc comment above it says the function answers undefined for a node that is not in the scene. The cache entry is removed only by `onRest` when the node is already gone at rest time. A node deleted while at rest never reaches that path, so `sceneTargets(scene.overrides)` grows by one Target (with its closures and axes) for every animated-then-deleted node over the scene's life. `sceneClipTargets` and `tweenPose` then work on a target whose `set` does nothing and still install an override for an id the scene lacks.
- evidence: read
- severity: medium

## A coast on pose targets canceled from outside moves the document with no undo entry and stays in the behavior's coast set
- where: packages/core/src/animation/behaviors/coastOnTargets.ts:126 (coast.stop / commitFlick)
- scenario: release a flick over a scene-backed adapter, then call `animator.cancelAll()` (or unmount the animator) mid-coast. Canceling a target decay commits the pose it reached, so the document now holds the mid-coast pose. Cancel skips `onDone`, so `halted` and `commitFlick` never run: no 'flick' op is recorded, and undo cannot return the node to its pre-drag pose. Each rider's `handle` also stays non-null, and the coast stays in `coasts` until a later drag of one of its ids calls `stop()`. `docs/unruled.md:1502` rules on this case only for the `previewPoses`/no-targets path (`coastByWrite`), where the document is left at the pre-drag pose. Here the document itself moves outside history.
- evidence: read
- severity: low

## rewindingTween ends a redo or undo leg early and jumps when the easing overshoots
- where: packages/core/src/animation/rewind.ts:71 (rewindingTween leg)
- scenario: run `tweenPose({ rewind: true, easing: easeOutBack })`. Undo mid-flight, then redo at a time when `ease(at/ms) > 1` (the overshoot part of easeOutBack). The forward leg's guard `done >= 1` takes that as "the pose is at that end already". It calls `target.stop({ commit: false })`, so the node snaps from its overshot position onto `to`, and it calls `onDone` even though `at < ms`. The same happens going back with an easing that dips below 0 (easeInBack, `done <= 0`): the node snaps to `start`. The guard should be on the time left (`span`), not on the eased value.
- evidence: read
- severity: low

## rigFromNode writes skins by plain assignment, so a node id of `__proto__` loses its skin
- where: packages/core/src/animation/rig/rigNode.ts:116 (read)
- scenario: a child of a rig node has id `__proto__` and a `data.skin`. `out.skins[child] = skin` sets the prototype of `out.skins` instead of an own key, so `Object.entries(skins)` in `bindSkins` never sees the node and its path does not bend. The same function stores bindings through `setOwn`, and `bindRig` checks skins with `Object.hasOwn`, so the two tables give different answers for the same key.
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

<!-- done: 4 findings, files read: 25 -->
