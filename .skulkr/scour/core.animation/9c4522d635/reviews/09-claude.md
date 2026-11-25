## Baking a skinned node writes a world-space path into `data.path`, so a rotated node's path is rotated twice
- where: packages/core/src/animation/rig/skinBinding.ts:96 (bindSkins → write)
- scenario: a skinned node whose pose has `rotation` (or `transform`) ≠ 0, rig posed, then `rig.bake()`. `show` bends `s.rest`, which `dataRestPath` already carried into world space via `pathInWorld` (rotation applied), and sets `entry.pose = fromBounds(bounds, restPose)`, keeping the rest pose's rotation. `write()` stores that world path as `data.path` with that pose. `kit:path` paints `data.path` through `pathInWorld(path, pose)`: `pathInPoseBox` is the identity (the path's AABB is the pose box), then `poseFrameOf(pose)` rotates it again, so the baked shape lands turned by the node's rotation once more. The override path, painted as-is ("already where it is drawn"), looked right until the bake. It should store the path in the pose's frame (`worldEditToStorage(pose, path)` in geom inverts `pathInWorld`). With rotation 0 and no transform the bug does not show.
- evidence: read (skinBinding.ts, geom/src/paths/pathInWorld.ts, the comment in core/src/canvas/nodeShapes/pathPainter.ts:31)
- severity: medium

## coastByWrite canceled from outside leaves its preview on screen and never records the flick
- where: packages/core/src/animation/behaviors/coastByWrite.ts:44 (coast.stop), :63 (decay with no cancel watch)
- scenario: an adapter with `previewPoses` but no `poseTarget`. The user flicks a node, and mid-coast something cancels the decay (`animator.cancelAll()`, or `cancelKey` on the momentum key). A canceled decay never calls `onDone`, so `commitFlick` never runs: the last `previewPoses` frame stays installed, the document keeps the pre-drag pose under it, and no 'flick' op is recorded. The coast also stays in `coasts` until a later drag of the same id reaches `stop()`, and that path only deletes it without clearing the preview. Without `previewPoses`, the per-frame `setPose` writes stand and history has no entry for them. `coastOnTargets` covers this case with `animator.watch` on 'cancel'/'interrupt' and commits the flick, so the two coast paths answer the same event differently.
- evidence: read; that a canceled decay skips `onDone` is inferred from the animator's tween end path (`engine/offsetTween.ts`, `onCancel` → `leave` only) and the comment at animateLifecycle.ts:111
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

<!-- done: 2 findings, files read: 26 -->
