The write to `.skulk/out/findings.md` was refused for lack of permission, so the whole findings document is below instead.

# Audit round 37 — core.animation

## `rig.bake()` throws, and bakes nothing, once any bound or skinned node has been deleted
- where: packages/core/src/animation/rig/bindRig.ts:235-242 (bake); packages/core/src/animation/rig/skinBinding.ts:91-99 (write)
- scenario: bind a rig with `bindRig` or `useRig` (hoisted `bindings`, so it never rebinds). Delete one bound node, then call `rig.bake()`. `show` keeps setting that node's `entry.pose` every frame, so `bake` calls `scene.setPose(b.node, …)` for an id the scene no longer holds. `fieldEdits.setPose` calls `requireNode` and throws inside `scene.batch`, so no node is baked, `release()` never runs, and the overrides stay up. A deleted skinned node does the same through `skins.write()` → `scene.update`. Bake should skip nodes `scene.get` no longer answers.
- evidence: read
- severity: medium

## `momentum`'s `boundary: 'stop'` stops a node at the edge on one adapter path and lets it slide along the edge on the other
- where: packages/core/src/animation/behaviors/coastByWrite.ts:68-93 (onTick) vs packages/core/src/animation/behaviors/coastOnTargets.ts:109-122 (tick)
- scenario: flick two nodes with `bounds` and the default `'stop'`, so node A reaches an edge while node B is still inside. Over a scene adapter (`coastOnTargets`) A halts at the edge at once. Over an adapter with no `poseTarget` (`coastByWrite`) the coast ends only once every node has hit an edge (`allHit`). Until then A's clamped axis stays put and its other axis keeps decaying, so A drifts along the edge. That is `'continue'`, and the docs say `'stop'` "settles at the edge at once". The same option is answered two ways depending on the adapter.
- evidence: read
- severity: low

## `useRigNode` writes skins into a plain object by node id, so a child with id `__proto__` is not skinned
- where: packages/core/src/animation/rig/rigNode.ts:116 (read)
- scenario: a node under the rig node has id `"__proto__"` and a `data.skin`. `out.skins[child] = skin` sets the prototype of `out.skins` and adds no own entry. `bindSkins`'s `Object.entries` never sees that node, so its path does not bend, and `bindRig`'s `Object.hasOwn` both-bound-and-skinned check misses it. The line just below writes `out.bindings` through `setOwn`.
- evidence: read
- severity: low

## `scenePoseTarget`'s per-scene target cache keeps an entry for every node ever animated and later deleted
- where: packages/core/src/animation/poseTarget.ts:149,220-222,228 (scenePoseTarget)
- scenario: an entry is dropped only in `onRest`, and only if the node is already gone when an animation comes to rest. A node that is animated, comes to rest and is deleted later keeps its `Target` (its axes, its closures over the scene, its last pose) in the map for the scene's life. So does a target made and never animated, such as `sceneClipTargets` resolving `pose:<id>` for a clip that never plays, after its node is deleted. A long editing session grows the map without bound.
- evidence: read
- severity: low

## `animateLifecycle` leaves a node stuck in `leaving`, or at its enter pose, when `tweenPose` throws
- where: packages/core/src/animation/wrappers/animateLifecycle.ts:44-60,66-88 (insertNode, removeNode)
- scenario: an adapter with no `poseTarget` (or a pose with no axes), with a geometry that has no `lerp`. `removeNode(id)` adds `id` to `leaving`, then `tweenPose` throws "geometry has no lerp". The node is not removed, and every later `removeNode(id)` returns at `leaving.has(id)`, so it can never be removed through the wrapper. `insertNode` writes the `enterFrom` pose with `setPoseInstant` before `tweenPose` throws, so the node stays at its enter pose for good.
- evidence: read
- severity: low

## `animateOnSetPose` and `animateLifecycle` keep their 200 ms default under `prefers-reduced-motion`, where the reflow default yields
- where: packages/core/src/animation/wrappers/animateOnSetPose.ts:50; packages/core/src/animation/wrappers/animateLifecycle.ts:39; compare packages/core/src/animation/reflowGlide.ts:20 (defaultMs)
- scenario: with Reduce Motion on, a reflow with no `ms` settles at once, as the round-19 ruling requires ("a kit default that moves something yields"). An `animateOnSetPose` or `animateLifecycle` wrapper with no `ms` still glides every `setPose`, insert and removal over 200 ms. Two kit defaults answer the preference the opposite way from the reflow default.
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