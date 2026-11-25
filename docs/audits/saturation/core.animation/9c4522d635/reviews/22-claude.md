## coastByWrite never ends a coast its decay lost to an outside cancel: the preview stays up, no flick is recorded, the coast stays in the set
- where: packages/core/src/animation/behaviors/coastByWrite.ts:61 (coastByWrite, decay start; no cancel watch)
- scenario: a flick coasts over an adapter with `previewPoses` but no `poseTarget`; mid-coast `animator.cancelAll()` runs (or the canvas's animator is disposed on unmount). A canceled decay does not call `onDone` (coastOnTargets.ts:166-171 watches for exactly this for that reason), so `commitFlick` never runs: the nodes stay shown at the last preview frame (`previewPoses` is never handed `null` for them), the document keeps the pre-drag pose, nothing is recorded, and the `Coast` stays in `coasts` until a later drag touches the same ids. coastOnTargets answers the same event by halting and recording the flick; this path should too (watch `cancel`/`interrupt` for the decay's id and call `commitFlick`).
- evidence: read
- severity: medium

## A baked skin writes its world-space bent path into `data.path` while keeping the rest pose's rotation, so a rotated node is turned twice
- where: packages/core/src/animation/rig/skinBinding.ts:86-89,100-102 (bindSkins show/write)
- scenario: a skinned node whose pose has `rotation` (or a `transform`) is bound. `dataRestPath` reads `pathInWorld(data.path, pose)`, i.e. the path already rotated into world space; `skinPath` bends that world path, and `write` stores it as `data.path` with `pose = descriptor.fromBounds(boundsOfPath(path), restPose)`, which keeps `restPose.rotation`. `pathInWorld` then rotates the stored path again about the new box, so after `rig.bake()` the node is drawn rotated by twice its rotation (and the next `bindRig`'s `dataRestPath` reads that doubled path). The inverse exists: `worldEditToStorage(pose, worldPath)` in `@weasel-js/geom` gives the stored path and pose that reproduce a world path; unrotated nodes are unaffected because `pathInPoseBox` only rebases the AABB.
- evidence: read (packages/geom/src/paths/pathInWorld.ts:28-83)
- severity: medium

## useRigNode keeps a rig placed by the old descriptor when only `descriptor` changes
- where: packages/core/src/animation/rig/rigNode.ts:168-169,222-226 (sameRefs / useRigNode)
- scenario: `useRigNode({ scene, node, descriptor })` re-renders with a different `descriptor` and an unchanged scene. The memo rereads with the new descriptor, so `placeSkeleton` places the skeleton differently, but `refs` holds only nodes, poses, data and skins, so `sameRefs(held, next)` is true and `parts` stays the held reading: the rig keeps the skeleton placed by the old descriptor (while `useSeatedRig` does rebind with the new `descriptor` for `apply`). The two reads of one option disagree until some scene edit under the rig forces a new reading.
- evidence: read
- severity: low

## Under `boundary: 'stop'`, coastByWrite never ends early when a dragged id has no release pose
- where: packages/core/src/animation/behaviors/coastByWrite.ts:24,97 (riding / every-stopped check)
- scenario: `ctx.draggedIds` holds an id not in `ctx.current` (the case `momentum`'s `targetsOf` and `onEnd` explicitly allow for). It is put in `riding`, skipped each tick (`startPoses` has none) and so never added to `stopped`; `[...riding].every((id) => stopped.has(id))` is never true. Every real node meets the edge and halts, yet the coast keeps running invisibly to the decay's rest and records the flick only then, unlike coastOnTargets, which makes riders only of ids with a target. `riding` should start from the ids that have a start pose.
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

<!-- done: 4 findings, files read: 26 -->
