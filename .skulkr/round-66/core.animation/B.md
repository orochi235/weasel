# Audit round 66 — core.animation findings

## animateLifecycle: re-inserting a node whose exit is still running inserts an id the scene still holds, which a scene-backed adapter refuses
- where: packages/core/src/animation/wrappers/animateLifecycle.ts:48-49 (insertNode)
- scenario: with `exitTo` set, `removeNode('a')` only starts the exit tween; the node stays in the scene until the tween ends (`remove` → `adapter.removeNode`). If `insertNode({ id: 'a', … })` comes in before then (the case the comment at line 47 handles: "A node back before its exit ended stays"), `leaving.get('a')()` calls the removal off and restores the pose, so 'a' is still in the scene, and then line 49 calls `adapter.insertNode(object, index)` anyway. Over the adapter the docstring names (`sceneToAdapter`/`useSceneAdapter`), `insertNode` is `scene.add` (`core/scene/sceneMutators.ts:73`), and adding an id the scene holds throws `Scene: id collision on "a"` (`core/scene/kitOps.ts:192-193`). So the call throws, or on a store that tolerates it, the node is duplicated. What should happen: when the exit is called off, the node is already present, so the wrapper should update it in place (its pose/data from `object`) or skip the inner insert, not insert it a second time. The unit test (`animateLifecycle.test.ts:160`) misses this because its fake `insertNode` is a `Map.set`, which overwrites.
- evidence: read
- severity: high

## coastOnTargets: a flick with no riders never ends, so its coast stays registered and its animator watch is never removed
- where: packages/core/src/animation/behaviors/coastOnTargets.ts:165-184 (coastOnTargets); packages/core/src/animation/behaviors/momentum.ts:96-107 (targetsOf)
- scenario: `targetsOf` skips every dragged id missing from `ctx.current` (line 101) and can return an empty, non-null map. `coastOnTargets` then adds the coast to `coasts` and subscribes `animator.watch` (line 168), but with no riders no decay launches, `halted` never runs, and `commitFlick`, the only place that calls `unwatch()` and deletes the coast, is never reached. The watch listener and the `Coast` entry stay until a later drag happens to include one of its ids. `onEnd` also returns `null`, which suppresses the move action's own commit for that release. What should happen: with no riders, the flick should end at once, or `momentum` should fall back to not coasting.
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
