# core.animation findings

## `Rig.bake` compounds under `useRigNode`: the bake's own write rebinds the rig with the baked poses as rest while the seat keeps the baked skeleton pose
- where: packages/core/src/animation/rig/bindRig.ts:236 (bindRigOn → rig.bake), with packages/core/src/animation/rig/rigNode.ts:216 (useRigNode)
- scenario: a rig from `useRigNode`, posed to `{ arm: { rotation: π/6 } }`, then `rig.bake()`. The bake calls `scene.setPose` on every bound node, and writes `data.path` on every skinned one. Each is a new pose or data object, so `read()`'s `refs` differ, `useRigNode` hands `useSeatedRig` new `bindings`/`skins` objects, and `bindRigOn` runs again. It reads each bound node's rest as `n.pose`, which is now the baked pose, and each skinned node's rest path as the bent path. The seat is kept, because the joint names did not change, so `target` still commits `{ arm: { rotation: π/6 } }`. The next `rig.pose(...)` with that same pose, or the next frame of any animation on the target, carries the baked rest by `fromRest` a second time: the arm's nodes show at π/3, and the skin bends twice. `bake`'s contract ("Later frames stay relative to the bind-time rest, so baking does not compound") only holds for `bindRig`/`useRig` with memoized options. A fix needs either the bake to reset the seat's committed pose to the bind pose `{}`, or `useRigNode` to keep the rest across a rebind its own bake caused.
- evidence: read (traced through `read`, `sameRefs`, `useSeatedRig`'s memo deps and `createRigSeat`; not run)
- severity: medium

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

<!-- done: 1 findings, files read: 26 -->
