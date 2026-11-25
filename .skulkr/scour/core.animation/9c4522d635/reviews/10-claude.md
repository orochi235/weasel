# core.animation findings

## A baked (and shown) skinned path is stored in world space under a pose that still carries its rotation, so a rotated skinned node is transformed twice
- where: packages/core/src/animation/rig/skinBinding.ts:85 (bindSkins → show) and :92 (write)
- scenario: `dataRestPath` builds the rest path with `pathInWorld(path, pose)`, which rebases the stored path into the pose box and then applies `poseFrameOf(pose)` (rotation / transform about the box center). `skinPath` bends that world-space path, and `show`/`write` keep it as `entry.path` / `data.path` with `pose = descriptor.fromBounds(boundsOfPath(path), s.restPose)`, which keeps `restPose`'s `rotation`/`transform`. Painting that node (`kit:path`, `pathInWorld`) rebases the world path into the box and applies the rotation again. For a skinned node with `rotation: π/4`, the rig's bent path is shown, and after `rig.bake()` written, rotated by π/2 instead of π/4. It should store the world path through the pose frame's inverse (`worldEditToStorage` in `@weasel-js/geom` exists for exactly this). Unrotated nodes are unaffected, since the rebase is then the identity.
- evidence: read (skinBinding.ts, geom/paths/pathInWorld.ts); the renderer's use of an override's `path` through `pathInWorld` is inferred from `dataRestPath`'s own doc ("as `kit:path` paints it")
- severity: medium

## momentum picks pose targets with one descriptor default and coasts them with another
- where: packages/core/src/animation/behaviors/momentum.ts:104 (targetsOf) vs :82
- scenario: with no `poseDescriptor` option, the coast's `d` is `AUTO_POSE_DESCRIPTOR`, but `adapter.poseTarget(id, opts.poseDescriptor)` is passed `undefined`, which `scenePoseTarget` defaults to `RECT_POSE_DESCRIPTOR`. The target's axes (and the axis count it is cached under) come from one descriptor while `poseVelocity`, `clampCorner` bounds and `translatePoseViaDescriptor` in `coastOnTargets` read and write the pose through the other. For a pose the two read differently (a polygon/path pose that AUTO translates by its points), the decay velocity is built from translations the target's axes do not describe. It also means momentum's lookup and a `tweenPose` with `geometry: AUTO_POSE_DESCRIPTOR` on the same node compare axis counts under different descriptors in `scenePoseTarget`, so a node at rest can have its target rebuilt between the two. Passing `d` would make it one decision.
- evidence: read (inference on how AUTO and RECT differ for non-rect poses)
- severity: low

## bindRig refuses a node both skinned and bound, but silently accepts one node bound twice
- where: packages/core/src/animation/rig/bindRig.ts:186 (bindRigOn binding loop)
- scenario: `bindings: { upper: ['a'], lower: ['a'] }` (or `['a', 'a']`) pushes two `Bound` entries for node `a`, each with its own `PoseOverride` entry; both are installed with `overrides.set`, and the node shows whichever ply wins while `bake` writes both, last one standing. The skinned-and-bound conflict right above throws with a clear message; a double binding should be refused the same way.
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

<!-- done: 3 findings, files read: 26 -->
